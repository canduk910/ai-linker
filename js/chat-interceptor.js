import { setPendingEntities } from "./store/entities.js";

const CHAT_ENDPOINTS = ["/api/chat", "/.netlify/functions/chat"];
const EXTRACT_PRIMARY = "/api/extract-entities";
const EXTRACT_FALLBACK = "/.netlify/functions/extract-entities";

const _origFetch = window.fetch.bind(window);

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

window.fetch = async (input, init = {}) => {
  const res = await _origFetch(input, init);

  try {
    const url = typeof input === "string" ? input : input?.url;
    const isChat = CHAT_ENDPOINTS.some((p) => url?.includes(p));
    const isPost = (init?.method || "GET").toUpperCase() === "POST";

    if (isChat && isPost) {
      // 요청 본문에서 messages 뽑기 (문자열 JSON일 때)
      let reqMessages = null;
      if (typeof init.body === "string") {
        try {
          const parsed = JSON.parse(init.body);
          reqMessages = parsed?.messages || parsed?.data?.messages;
        } catch {}
      }

      if (Array.isArray(reqMessages) && reqMessages.length) {
        // 1차 시도: /api/extract-entities → 실패시 fallback
        let entities =
          (await safePost(EXTRACT_PRIMARY, { messages: reqMessages })) ||
          (await safePost(EXTRACT_FALLBACK, { messages: reqMessages }));

        if (entities && typeof entities === "object") {
          setPendingEntities(entities); // 세션 저장 → apply.html에서 배너 자동 노출
        }
      }
    }
  } catch {
    // 인터셉트 실패는 전체 UX에 영향 없도록 그냥 무시
  }

  return res;
};
