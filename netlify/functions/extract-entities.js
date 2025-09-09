// 경로: /.netlify/functions/extract-entities
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { messages = [] } = JSON.parse(event.body || "{}");
    const text = messages.map((m) => m?.content || "").join("\n");

    // ===== 규칙 기반 추출 =====
    const phone =
      (text.match(/\b01[016789]-?\d{3,4}-?\d{4}\b/) || [])[0] || null;
    const email =
      (text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i) || [])[0] || null;

    const bizRegRaw = (text.match(/\b\d{3}-?\d{2}-?\d{5}\b/) || [])[0] || null;
    const bizRegNo = bizRegRaw ? bizRegRaw.replace(/[^0-9]/g, "") : null;

    const amount = parseKRW(text); // 금액(원)
    const termMonths = parseTermMonths(text); // 기간(개월)
    const purpose = pickOne(text, ["운전자금", "시설자금", "창업자금", "기타"]);

    const name = guessKoreanName(text); // 대표자 이름(휴리스틱)
    const bizName = extractBizName(messages) || guessBizNameSafe(text);

    // ===== confidence 계산 =====
    const confidence = {};
    if (phone) confidence["borrower.phone"] = 0.95;
    if (email) confidence["borrower.email"] = 0.9;
    if (bizRegNo) confidence["business.regNo"] = 0.85;
    if (amount != null) confidence["loan.desiredAmountKRW"] = 0.8;
    if (termMonths != null) confidence["loan.desiredTermMonths"] = 0.6;
    if (purpose) confidence["loan.purpose"] = 0.8;
    if (name) confidence["borrower.name"] = 0.7;
    if (bizName) confidence["business.name"] = Math.max(confidence["business.name"] || 0.8, 0.8);

    // 사업자번호 체크섬이 틀리면 신뢰도 보정
    if (bizRegNo && !isValidBizRegNo(bizRegNo)) {
      confidence["business.regNo"] = Math.min(
        confidence["business.regNo"] || 0.6,
        0.3
      );
    }

    const out = {
      borrower: { name, phone, email },
      business: { name: bizName, regNo: bizRegNo },
      loan: {
        purpose,
        desiredAmountKRW: amount,
        desiredTermMonths: termMonths,
      },
      metadata: {
        source: "chat",
        updatedAt: new Date().toISOString(),
        confidence,
      },
    };

    return { statusCode: 200, headers: CORS, body: JSON.stringify(out) };
  } catch (err) {
    console.error("extract-entities error:", err);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

/* ================== 유틸 함수들 ================== */

// "50,000,000원", "5천만원", "2억 3천만 원" 등 파싱 → 정수(원)
function parseKRW(text) {
  const numMatch = text.match(/([\d,]+)\s*원/);
  if (numMatch) {
    const n = Number(numMatch[1].replace(/,/g, ""));
    if (!Number.isNaN(n)) return n;
  }
  const word = normalizeKrwWords(text);
  if (word != null) return word;
  return null;
}

function normalizeKrwWords(t) {
  // 억/천만/백만/만 조합 간단 처리
  const eok = numOf((t.match(/(\d+(?:\.\d+)?)\s*억/) || [])[1]);
  const cheonmanA = numOf((t.match(/(\d+)\s*천만/) || [])[1]);
  const cheonmanB = numOf((t.match(/(\d+)\s*천\s*만/) || [])[1]);
  const baegman = numOf((t.match(/(\d+)\s*백만/) || [])[1]);
  const man = numOf((t.match(/(\d+)\s*만[^\d]?원?/) || [])[1]);

  if (eok || cheonmanA || cheonmanB || baegman || man) {
    let total = 0;
    total += eok * 100_000_000;
    total += (cheonmanA + cheonmanB) * 10_000_000;
    total += baegman * 1_000_000;
    total += man * 10_000;
    return total || null;
  }
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
  // “대표자 이름: 홍길동”, “대표 이름 홍길동”, “저는 홍길동입니다” 등
  const r =
    text.match(/대표[자]?\s*(?:이름|성함|명)\s*[:\s]*([가-힣]{2,4})/) ||
    text.match(/저는\s*([가-힣]{2,4})입니다/);
  return r ? r[1] : null;
}

// === 개선: 최근 메시지부터, '라벨 + 구분자'가 있는 구조만 선호, 문장/의문문은 제외
function extractBizName(messages = []) {
  const LABEL = /(?:사업자명|상호명?|회사명|법인명|점명)\s*[:\-]\s*([^\n#•\-]{1,40})/i;
  const CLEAN = (s) =>
    String(s || "")
      .replace(/\*\*/g, "")            // markdown bold
      .replace(/^[\s,:\-–—]+|[\s,:\-–—]+$/g, "")
      .replace(/[^\w\s·().&가-힣\-]/g, "") // 허용 문자만
      .trim();
  const BAD = /(무엇|뭐|인가요|인가|요\?|있나요|\?|주세요|해줘|작성할래)/;

  for (let i = messages.length - 1; i >= 0; i--) {
    const t = messages[i]?.content || "";
    const m = t.match(LABEL);
    if (!m) continue;
    let cand = CLEAN(m[1]);
    if (!cand || BAD.test(cand)) continue;
    // 너무 짧거나 긴 값 제거
    if (cand.length < 2 || cand.length > 40) continue;
    // 보편적 접미어 보정(선택)
    cand = cand.replace(/\s+주식회사$/,"주식회사");
    return cand;
  }
  return null;
}

// 레거시 안전 버전: '회사' 단독 키워드는 금지(회사명/상호/사업자명만 허용)
function guessBizNameSafe(text) {
  const r = text.match(/(?:사업자명|상호명?|회사명|법인명|점명)\s*[:\-\s]\s*([^\n#•\-]{1,40})/i);
  if (!r) return null;
  const val = r[1].trim();
  // 의문문/명령문 제거
  if (/[?]|(무엇|뭐|인가요|인가|해주세요|해줘)/.test(val)) return null;
  return val.replace(/\*\*/g,"").replace(/^[\s,:\-–—]+|[\s,:\-–—]+$/g,"");
}

// 사업자등록번호(10자리) 체크섬
function isValidBizRegNo(raw) {
  const d = String(raw).replace(/[^0-9]/g, "");
  if (d.length !== 10) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  const sum =
    w.reduce((acc, wi, i) => acc + parseInt(d[i], 10) * wi, 0) +
    Math.floor((parseInt(d[8], 10) * 5) / 10);
  return ((10 - (sum % 10)) % 10) === parseInt(d[9], 10);
}

function numOf(s) {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
