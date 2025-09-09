export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { messages = [] } = await request.json();
    const text = messages.map(m => m?.content || "").join("\n");

    // ===== 규칙 기반 추출 =====
    const phone = (text.match(/\b01[016789]-?\d{3,4}-?\d{4}\b/) || [])[0] || null;
    const email = (text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [])[0] || null;
    const bizRegRaw = (text.match(/\b\d{3}-?\d{2}-?\d{5}\b/) || [])[0] || null;
    const bizRegNo = bizRegRaw ? bizRegRaw.replace(/[^0-9]/g, "") : null;

    const amount = parseKRW(text); // 금액(원) 숫자로
    const termMonths = parseTermMonths(text); // 대출기간(개월)
    const purpose = pickOne(text, ["운전자금","시설자금","창업자금","기타"]);

    // 이름 추정(아주 가벼운 휴리스틱, 필요시 보정)
    const name = guessKoreanName(text);

    // 상호 추정(“상호/회사/법인/가게/점” 키워드 근처)
    const bizName = guessBizName(text);

    // ===== confidence 대략치 =====
    const confidence = {};
    if (phone) confidence["borrower.phone"] = 0.95;
    if (email) confidence["borrower.email"] = 0.9;
    if (bizRegNo) confidence["business.regNo"] = 0.85;
    if (amount != null) confidence["loan.desiredAmountKRW"] = 0.8;
    if (purpose) confidence["loan.purpose"] = 0.8;
    if (name) confidence["borrower.name"] = 0.7;
    if (bizName) confidence["business.name"] = 0.7;

    const out = {
      borrower: { name, phone, email },
      business: { name: bizName, regNo: bizRegNo },
      loan: { purpose, desiredAmountKRW: amount, desiredTermMonths: termMonths },
      metadata: { source: "chat", updatedAt: new Date().toISOString(), confidence }
    };

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("extract-entities error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ====== 간단 파서 유틸 ======
function parseKRW(text) {
  // 숫자 (“50,000,000원”) 우선
  const numMatch = text.match(/([\d,]+)\s*원/);
  if (numMatch) {
    const n = Number(numMatch[1].replace(/,/g, ""));
    if (!Number.isNaN(n)) return n;
  }
  // 한글 단위 (“5천만원”, “2억 3천만 원” 등)
  const unit = normalizeKrwWords(text);
  if (unit != null) return unit;
  return null;
}

function normalizeKrwWords(t) {
  // 아주 단순 구현: 억/천만/백만/만 조합
  const m = t.match(/(\d+(?:\.\d+)?)\s*억/) || [];
  const eok = m[1] ? Number(m[1]) : 0;
  const cheonman = (t.match(/(\d+)\s*천만/) || [])[1] ? Number((t.match(/(\d+)\s*천만/) || [])[1]) : 0;
  const baegman = (t.match(/(\d+)\s*백만/) || [])[1] ? Number((t.match(/(\d+)\s*백만/) || [])[1]) : 0;
  const man = (t.match(/(\d+)\s*만[^\d]?원?/) || [])[1] ? Number((t.match(/(\d+)\s*만[^\d]?원?/) || [])[1]) : 0;
  const cheonmanFromChun = (t.match(/(\d+)\s*천\s*만/) || [])[1] ? Number((t.match(/(\d+)\s*천\s*만/) || [])[1]) : 0;

  if (eok || cheonman || baegman || man || cheonmanFromChun) {
    // 억 = 100,000,000
    let total = eok * 100_000_000;
    total += (cheonman + cheonmanFromChun) * 10_000_000;
    total += baegman * 1_000_000;
    total += man * 10_000;
    return total || null;
  }
  // “5천만원”
  const m2 = t.match(/(\d+)\s*천\s*만\s*원?/);
  if (m2) return Number(m2[1]) * 10_000_000;
  return null;
}

function parseTermMonths(text) {
  const m = text.match(/(\d+)\s*(개월|달|월)/);
  if (m) return Number(m[1]);
  return null;
}

function pickOne(text, arr) {
  const found = arr.find((k) => text.includes(k));
  return found || null;
}

function guessKoreanName(text) {
  // 매우 단순: “대표(자) 이름/성함/명” 주변 2~3글자 추출
  const r = text.match(/대표[자]?\s*(?:이름|성함|명)[:\s]*([가-힣]{2,4})/);
  if (r) return r[1];
  // “저는 OOO입니다”
  const r2 = text.match(/저는\s*([가-힣]{2,4})입니다/);
  if (r2) return r2[1];
  return null;
}

function guessBizName(text) {
  const r = text.match(/(?:상호|회사|법인|가게|점)\s*[:\s]*([^\n]{1,20})/);
  if (r) return r[1].trim();
  return null;
}
