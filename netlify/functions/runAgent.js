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

/*
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
