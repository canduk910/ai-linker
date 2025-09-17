// netlify/functions/runAgent.js  (ESM, Modern Functions)
export default async (req, context) => {
  const t0 = Date.now();
  const trace = [];
  const log = (stage, extra = {}) => {
    const item = { stage, ts: new Date().toISOString(), ms: Date.now() - t0, ...extra };
    console.log("[runAgent]", item); // Netlify Functions 로그에 남음
    trace.push(item);
  };

  // CORS 프리플라이트 (필요 시)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN || "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, API_KEY, X-Debug",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    });
  }

  try {
    const reqUrl = new URL(req.url);
    const debug = reqUrl.searchParams.get("debug") === "1" || req.headers.get("x-debug") === "1";
    log("start", { method: req.method, debug });

    // 1) 환경변수 점검
    const baseRaw = (process.env.AI_LINKER_BASE || "").trim();
    const apiKey  = process.env.AI_LINKER_API_KEY || "";
    if (!baseRaw) throw new Error("AI_LINKER_BASE is empty/undefined");
    if (!apiKey)  log("warn", { msg: "AI_LINKER_API_KEY is empty" });

    // 2) URL 안전 결합
    let target = "";
    try {
      target = new URL("/run-agent", baseRaw.replace(/\/+$/, "")).toString();
    } catch {
      throw new Error(`Invalid AI_LINKER_BASE: ${baseRaw}`);
    }
    const isLocal = /^(http:\/\/)?(localhost|127\.0\.0\.1)/i.test(baseRaw);
    log("build-url", { target, isLocal });

    // 3) 요청 바디 읽기
    const bodyText = await req.text();
    log("read-body", { bodyBytes: bodyText.length });

    // 4) 타임박스
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 29000); // 동기 함수 한계 대응

    // 5) API 호출
    log("fetch-start");
    const r = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "API_KEY": apiKey
      },
      body: bodyText,
      signal: controller.signal
    });

    const respText = await r.text();
    clearTimeout(timeoutId);
    log("fetch-end", { status: r.status, bytes: respText.length });

    // 6) 응답 구성(헤더로 핵심 trace 전달)
    const hdrs = new Headers({
      "content-type": r.headers.get("content-type") || "application/json",
      "X-Trace-Target-Host": new URL(target).host,
      "X-Trace-Duration": String(Date.now() - t0),
    });

    if (debug) {
      hdrs.set("Access-Control-Allow-Origin", process.env.CORS_ALLOW_ORIGIN || "*");
      return new Response(JSON.stringify({
        ok: r.ok,
        status: r.status,
        data: safeJson(respText),
        trace
      }), { status: r.status, headers: hdrs });
    }
    return new Response(respText, { status: r.status, headers: hdrs });

  } catch (err) {
    // 네트워크/타임아웃/URL/권한 등 모든 오류를 추적에 남김
    log("error", { message: String(err), code: err?.code, cause: err?.cause?.code });
    const hdrs = new Headers({
      "content-type": "application/json",
      "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN || "*"
    });
    return new Response(JSON.stringify({ error: "runAgent failed", detail: String(err), trace }), {
      status: 502, headers: hdrs
    });
  }
};

function safeJson(t) { try { return JSON.parse(t); } catch { return t; } }

/*
// netlify/functions/runAgent.js
export default async (req, context) => {
  const started = Date.now();
  console.log("[runAgent] start", { ts: new Date().toISOString() });

  // 1) 타임아웃 컨트롤러
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 29000); // 동기 함수 한계에 맞춰 ~29s
  //             ^^^^^^^^^  ← 아래 finally에서도 같은 이름으로 사용!

  let status = 500, bytes = 0;
  try {
    const bodyText = await req.text();
    console.log("[runAgent] before fetch FastAPI", { bodyBytes: bodyText.length });

    const r = await fetch(`${process.env.AI_LINKER_BASE}/run-agent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "API_KEY": process.env.AI_LINKER_API_KEY
      },
      body: bodyText,
      signal: controller.signal
    });

    const text = await r.text();
    status = r.status;
    bytes = text.length;

    console.log("[runAgent] after fetch FastAPI", {
      status, ms: Date.now() - started, bytes
    });

    return new Response(text, {
      status,
      headers: { "content-type": "application/json" }
    });

  } catch (err) {
    console.error("[runAgent] ERROR", { ms: Date.now() - started, message: String(err) });
    return new Response(JSON.stringify({ error: "runAgent failed", detail: String(err) }), {
      status: 502,
      headers: { "content-type": "application/json" }
    });
  } finally {
    clearTimeout(timeoutId); // ← 변수명 일치!
    console.log("[runAgent] finally", { totalMs: Date.now() - started, status, bytes });
  }
};


export default async (req) => {
  // CORS 프리플라이트
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN || "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, API_KEY",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      }
    });
  }

  const base = (process.env.AI_LINKER_BASE || "").replace(/\/$/, "");
  const url = `${base}/run-agent`;
  let payload = {};
  try { payload = await req.json();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "API_KEY": process.env.AI_LINKER_API_KEY || ""
    },
    body: JSON.stringify({
      user_id: payload.user_id || "user_kim",
      query: payload.query || ""
    })
  });

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
      "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN || "*"
    }
  });
 } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 504 });
  } finally {
    clearTimeout(timer);
  }
};
*/
