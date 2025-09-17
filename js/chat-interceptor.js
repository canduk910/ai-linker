import { setPendingEntities } from "./store/entities.js";

// 기존 + 추가(run-agent) 엔드포인트 모두 관찰
const CHAT_ENDPOINTS = [
  "/api/chat",
  "/.netlify/functions/chat",
  "/api/run-agent",
  "/.netlify/functions/runAgent",
];

const EXTRACT_PRIMARY = "/.netlify/functions/extract-entities";
const EXTRACT_FALLBACK = "/api/extract-entities";

const _origFetch = window.fetch.bind(window);

// ===== 스트리밍 렌더 관련 설정 =====
const STREAM_DELAY_MS = 1000; // 1초 간격
// 최종 메시지를 "스트리밍 후 말풍선으로도" 덧붙일지 여부
// false면 최종 메시지는 스트리밍하지 않고 앱의 기본 렌더에 맡김
// 전역 토글: window.AILINKER_STREAM_APPEND_FINAL === false 이면 덮어씀
let STREAM_APPEND_FINAL_DEFAULT = true;

async function safePost(url, payload) {
  try {
    const r = await _origFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return await r.json();
  } catch (e) {
    return null;
  }
}

// === DOM 유틸 ===
function getMessagesContainer() {
  return (
    document.querySelector("#chat-messages") ||
    document.querySelector("[data-chat-messages]") ||
    null
  );
}

function appendBubble(container, text, variant) {
  if (!container) return;
/*  
  // DaisyUI 스타일 가정 (없어도 안전하게 동작)
  const wrap = document.createElement("div");
  wrap.className = "chat " + (variant === "user" ? "chat-end" : "chat-start");

  const bubble = document.createElement("div");
  const base = "chat-bubble whitespace-pre-wrap break-words";
  const styleByVariant =
    variant === "log"
      ? " chat-bubble-secondary text-xs font-mono"
      : variant === "final"
      ? ""
      : " chat-bubble-primary";

  bubble.className = base + styleByVariant;
  bubble.textContent = String(text || "");
  wrap.appendChild(bubble);

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
*/  
  // ✅ 기존 chatbot.html의 버블 마크업을 그대로 재사용
  //   - user  → .message.user-message
  //   - log/final(assistant) → .message.system-message
  const div = document.createElement("div");
  if (variant === "user") {
    div.className = "message user-message";
  } else {
    // log / final 모두 기존 답변색(.system-message)으로
    div.className = "message system-message";
  }
  div.textContent = String(text || "");
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;  
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 로그 스트리밍 (DOM이 없으면 이벤트만 발행)
async function streamExecutionLog(logs = [], finalMsg = "") {
  const container = getMessagesContainer();
  const appendFinal =
    window.AILINKER_STREAM_APPEND_FINAL ?? STREAM_APPEND_FINAL_DEFAULT;

  if (!container) {
    // 페이지에서 직접 렌더하고 싶다면 이 이벤트를 구독
    window.dispatchEvent(
      new CustomEvent("ai:execution_log", {
        detail: { logs, finalMsg, delayMs: STREAM_DELAY_MS },
      })
    );
    return;
  }

  for (const line of logs) {
    appendBubble(container, line, "log");
    await sleep(STREAM_DELAY_MS);
  }
  if (appendFinal && finalMsg) {
    appendBubble(container, finalMsg, "final");
  }
}

window.fetch = async (input, init = {}) => {
  const res = await _origFetch(input, init);

  try {
    const url = typeof input === "string" ? input : input?.url;
    const isObserved = CHAT_ENDPOINTS.some((p) => url?.includes(p));
    const isPost = (init?.method || "GET").toUpperCase() === "POST";

    if (isObserved && isPost) {
      // ---- 요청 본문 파싱 ----
      let reqMessages = null;
      let reqQuery = null;

      if (typeof init.body === "string") {
        try {
          const parsed = JSON.parse(init.body);
          // 기존 /api/chat 형태
          reqMessages = parsed?.messages || parsed?.data?.messages;
          // run-agent 형태 { user_id, query }
          reqQuery = parsed?.query;
        } catch {
          // ignore
        }
      }

      // === 엔티티 추출: messages가 없고 query만 있으면 1개 메시지로 변환 ===
      let messagesForExtract = null;
      if (Array.isArray(reqMessages) && reqMessages.length) {
        messagesForExtract = reqMessages;
      } else if (reqQuery && typeof reqQuery === "string") {
        messagesForExtract = [{ role: "user", content: reqQuery }];
      }

      if (Array.isArray(messagesForExtract) && messagesForExtract.length) {
        const entities =
          (await safePost(EXTRACT_PRIMARY, { messages: messagesForExtract })) ||
          (await safePost(EXTRACT_FALLBACK, { messages: messagesForExtract }));

        if (entities && typeof entities === "object") {
          setPendingEntities(entities); // 세션 저장 → apply.html 배너 노출 용
        }
      }

      // ---- 응답을 들여다보고 execution_log 스트리밍 ----
      try {
        const cloneText = await res.clone().text();
        let data = {};
        try {
          data = cloneText ? JSON.parse(cloneText) : {};
        } catch {
          data = {};
        }

        if (Array.isArray(data.execution_log)) {
          const finalMsg = data?.final_result?.message || data?.message || "";
          // 비동기 스트리밍(화면 갱신), fetch 응답은 그대로 반환
          streamExecutionLog(data.execution_log, finalMsg).catch(() => {});

          // 앱 측 기본 최종 메시지 렌더 억제 옵션
          if (window.AILINKER_SUPPRESS_FINAL_IN_APP === true) {
            const altered = {
              ...data,
              final_result: { ...(data.final_result || {}), message: "" },
            };
            const headers = new Headers(res.headers);
            headers.set("Content-Type", "application/json");
            return new Response(JSON.stringify(altered), {
              status: res.status,
              statusText: res.statusText,
              headers,
            });
          }
        }
      } catch {
        // ignore
      }
    } // <-- close if (isObserved && isPost)
  } catch {
    // ignore
  }

  return res;
};
