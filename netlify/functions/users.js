export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN || "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, API_KEY",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      }
    });
  }
  const base = (process.env.AI_LINKER_BASE || "").replace(/\/$/, "");
  const url = `${base}/users`;

  const res = await fetch(url, {
    headers: {
      "API_KEY": process.env.AI_LINKER_API_KEY || ""
    }
  });

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
      "Access-Control-Allow-Origin": process.env.CORS_ALLOW_ORIGIN || "*"
    }
  });
};
