const AI_LINKER = (() => {
  const RUN_AGENT_URL = "/.netlify/functions/runAgent";
  const RAG_URL       = "/.netlify/functions/ragContent";
  const USERS_URL     = "/.netlify/functions/users";

  async function runAgent({ userId, query }) {
    const res = await fetch(RUN_AGENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, query })
    });
    if (!res.ok) throw new Error(`runAgent failed: ${res.status}`);
    return res.json(); // {status, final_result:{message}, execution_log:[]}
  }

  async function getRagContent() {
    const res = await fetch(RAG_URL, { method: "GET" });
    if (!res.ok) throw new Error(`rag-content failed: ${res.status}`);
    return res.json(); // [{ rag_documents: {...} }]
  }

  async function getUsers() {
    const res = await fetch(USERS_URL, { method: "GET" });
    if (!res.ok) throw new Error(`users failed: ${res.status}`);
    return res.json(); // [{ user_ids: [...] }]
  }

  return { runAgent, getRagContent, getUsers };
})();
