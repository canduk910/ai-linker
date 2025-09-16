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
