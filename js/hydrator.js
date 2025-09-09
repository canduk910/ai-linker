(function(){
  // ===== 설정 =====
  const ENTITIES_KEY = "aiLinker.pendingEntities.v1"; // {data, expiresAt}
  const POLICY = {
    strong: 0.85,   // 이 이상은 덮어쓰기 허용
    weak:   0.60,   // 이 이상은 표시(하이라이트), 이 이하는 기본 미채움
    fillEmptyOnly: true, // 기본은 빈칸만 채움
    allowOverwriteBelowStrong: false
  };
  const ORIGIN_ALLOW = [location.origin]; // 필요 시 여러 도메인 추가

  // 선택: select 동의어 매핑 (확장 가능)
  const SELECT_SYNONYM = {
    "loan.purpose": {
      "운전자금": ["운전자금", "운영자금", "운전 자금", "운영비"],
      "시설자금": ["시설자금", "설비자금", "시설", "설비"],
      "창업자금": ["창업자금", "창업", "개업"],
      "기타": ["기타", "기타자금", "기타 용도"]
    },
    "business.type": {
      "개인": ["개인", "개인사업자", "개인사업"],
      "법인": ["법인", "법인사업자", "주식회사", "유한회사"]
    }
  };

  // 전역 포맷/검증 유틸(스키마 A단계에서 로딩됨)
  const fmt = window.aiLinkerFormat?.forInput ?? ((_, v)=> v ?? "");
  const validators = window.aiLinkerValidators || {};

  // ===== 유틸 =====
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const byPath = (obj, path) => path.split(".").reduce((o,k)=>o?.[k], obj);

  function readEntitiesFromStorage() {
    try {
      const raw = localStorage.getItem(ENTITIES_KEY);
      if (!raw) return null;
      const { data, expiresAt } = JSON.parse(raw);
      if (expiresAt && Date.now() > +expiresAt) return null;
      return data || null;
    } catch { return null; }
  }

  function confidenceOf(path, entities){
    return entities?.metadata?.confidence?.[path];
  }

  function shouldFill(el, path, val, conf) {
    // 비즈니스명 이상치 가드: 의문문/명령문/긴 문장 제외
    if (path === "business.name" && typeof val === "string") {
      const s = val.trim();
      const looksSentence = /[?]|(무엇|뭐|인가요|해주세요|해줘|있으신가요)/.test(s);
      if (looksSentence || s.length > 40) return false;
    }    

    const cur = (el.tagName === "SELECT") ? el.value : el.value?.trim();
    const empty = !cur;
    if (val == null || val === "") return false;

    if (empty) return true; // 빈칸은 채움
    if (POLICY.fillEmptyOnly) return false;

    // 덮어쓰기 정책
    if (POLICY.allowOverwriteBelowStrong) {
      return true;
    }
    return (typeof conf === "number" && conf >= POLICY.strong);
  }

  // select 동의어/텍스트 매칭
  function setSelectValue(sel, path, value){
    const target = String(value).trim();
    // 퍼지 사전 우선
    const dict = SELECT_SYNONYM[path];
    if (dict) {
      const canonical = Object.keys(dict).find(key => dict[key].some(v => v === target));
      if (canonical) {
        const ok = trySetSelectTextOrValue(sel, canonical);
        if (ok) return true;
      }
    }
    // 일반 텍스트/밸류 매칭
    return trySetSelectTextOrValue(sel, target);
  }
  function trySetSelectTextOrValue(sel, target){
    let matched = false;
    for (const opt of sel.options) {
      const text = (opt.textContent || "").trim();
      if (opt.value === target || text === target) {
        sel.value = opt.value;
        matched = true; break;
      }
    }
    if (!matched && sel.options.length) {
      // value 미리 정의 안 된 커스텀 select일 수 있으니 직접 세팅
      sel.value = target;
      matched = true;
    }
    if (matched) sel.dispatchEvent(new Event("change", { bubbles:true }));
    return matched;
  }

  function normalizeForInput(path, val, el){
    if (val == null) return "";
    let v = val;

    // 날짜: YYYY-MM-DD로 통일
    if (el?.type === "date" && typeof v === "string") {
      const m = v.match(/\d{4}[./-]\d{2}[./-]\d{2}/);
      if (m) v = m[0].replace(/[./]/g, "-");
    }

    // 사업자번호 포맷
    if (path === "business.regNo") {
      const d = String(v).replace(/\D/g,"");
      if (d.length === 10) v = `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`;
    }

    // number input은 쉼표 없이
    if (el?.type === "number") {
      const n = Number(String(v).replace(/[^\d.-]/g,""));
      if (!Number.isNaN(n)) return String(n);
    }

    // 그 외는 포맷터
    return fmt(path, v);
  }

  function highlightByConfidence(el, path, conf){
    const base = el.tagName === "SELECT" ? "select" : el.tagName === "TEXTAREA" ? "textarea" : "input";
    el.classList.remove(`${base}-warning`, `${base}-success`, "border-yellow-400", "border-green-500");
    if (typeof conf !== "number") return;
    if (conf >= POLICY.strong) {
      el.classList.add(`${base}-success`, "border-green-500");
      el.title = (el.title ? el.title+" · " : "") + "신뢰도 높음";
    } else if (conf >= POLICY.weak) {
      el.classList.add(`${base}-warning`, "border-yellow-400");
      el.title = (el.title ? el.title+" · " : "") + "신뢰도 보통 — 제출 전 확인";
    }
  }

  function softValidate(el, path){
    if (path === "business.regNo" && validators.isValidBizRegNo) {
      const raw = String(el.value).replace(/\D/g,"");
      if (raw && !validators.isValidBizRegNo(raw)) {
        const base = el.tagName === "SELECT" ? "select" : el.tagName === "TEXTAREA" ? "textarea" : "input";
        el.classList.add(`${base}-warning`, "border-yellow-400");
        el.title = (el.title ? el.title+" · " : "") + "사업자등록번호 확인 필요";
      }
    }
  }

  function setField(el, path, value){
    if (el.tagName === "SELECT") {
      setSelectValue(el, path, value);
    } else {
      const next = normalizeForInput(path, value, el);
      const prev = el.value;
      if (prev && prev !== next) el.dataset.prev = prev; // undo용 스냅샷
      el.value = next;
      el.dispatchEvent(new Event("input", {bubbles:true}));
      el.dispatchEvent(new Event("change", {bubbles:true}));
    }
  }

  function hydrateWith(entities){
    if (!entities) return 0;
    const confidence = entities?.metadata?.confidence || {};
    let filled = 0;

    qsa("[data-field]").forEach(el=>{
      const path = el.getAttribute("data-field");
      const val  = byPath(entities, path);
      const conf = confidenceOf(path, entities);

      if (!shouldFill(el, path, val, conf)) return;

      // 덮어쓰려는 값이 number인데 input type=number가 너무 작게 보이면 inputmode 보강
      if (el.type === "number") el.setAttribute("inputmode","decimal");

      setField(el, path, val);
      highlightByConfidence(el, path, conf);
      softValidate(el, path);
      filled++;
    });

    if (filled > 0) toast(`대화 정보로 ${filled}개 필드를 채웠어요.`);
    return filled;
  }

  // ===== 배너/토스트 =====
  function toast(msg){
    const t = document.createElement("div");
    t.textContent = msg;
    t.className = "fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-sm px-4 py-2 rounded-lg shadow-lg opacity-90 z-50";
    document.body.appendChild(t);
    setTimeout(()=> t.remove(), 2200);
  }

  function showBannerIfEntities(){
    const e = readEntitiesFromStorage();
    if (!e) return;
    const banner = document.getElementById("autofill-banner");
    if (!banner) { hydrateWith(e); return; } // 배너 없으면 즉시 채움(임베드 모드)
    banner.classList.remove("hidden");
    document.getElementById("autofill-accept")?.addEventListener("click", ()=>{
      hydrateWith(readEntitiesFromStorage());
      banner.classList.add("hidden");
    }, { once:true });
    document.getElementById("autofill-reject")?.addEventListener("click", ()=>{
      banner.classList.add("hidden");
    }, { once:true });
  }

  // ===== 메시지 채널(핸드셰이크) =====
  function sendReady(){
    try { window.parent?.postMessage({ type:"AI_LINKER_APPLY_READY" }, location.origin); } catch {}
  }
  addEventListener("message", (e)=>{
    try {
      if (!ORIGIN_ALLOW.includes(e.origin)) return;
      const msg = e.data || {};
      if (msg.type === "AI_LINKER_ENTITIES" && msg.payload) {
        hydrateWith(msg.payload);
      }
    } catch {}
  });

  // ===== 스토리지 이벤트(다른 탭/iframe 갱신) =====
  addEventListener("storage", ()=>{
    showBannerIfEntities();
  });

  // ===== 부트 =====
  addEventListener("DOMContentLoaded", ()=>{
    sendReady();           // 부모에 준비됨 알림
    showBannerIfEntities();// 저장소에 있으면 배너 or 즉시 채움
    // URL 파라미터로 prefill 전달 시도: ?prefill=base64(json)
    const pf = new URLSearchParams(location.search).get("prefill");
    if (pf) {
      try { hydrateWith(JSON.parse(atob(pf))); } catch {}
    }
  });
})();

/*
// /js/hydrator.js
import { getPendingEntities, clearPendingEntities } from "./store/entities.js";

// 전역 유틸(스키마 A단계에서 로딩됨)
const fmt = window.aiLinkerFormat?.forInput ?? ((_, v) => v);
const validators = window.aiLinkerValidators || {};

const CONF_OK = 0.8;
const CONF_WARN = 0.5;

function getByPath(obj, path) {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

function setFieldValue(el, path, value) {
  if (value == null) return;

  // 날짜 입력 지원(YYYY-MM-DD로 맞춰 넣기)
  if (el.type === "date" && typeof value === "string") {
    const m = value.match(/\d{4}-\d{2}-\d{2}/) || value.match(/\d{4}[./]\d{2}[./]\d{2}/);
    if (m) value = m[0].replace(/[./]/g, "-");
  }

  // select는 option value 혹은 텍스트로 매칭
  if (el.tagName === "SELECT") {
    const target = String(value).trim();
    let matched = false;
    for (const opt of el.options) {
      if (opt.value === target || opt.text === target) {
        el.value = opt.value;
        matched = true;
        break;
      }
    }
    if (!matched && el.options.length) {
      // 그래도 못 찾으면 그대로 텍스트를 value로 시도(커스텀 value일 때)
      el.value = target;
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  // 숫자 input이면 숫자로, 아니면 포맷팅된 문자열
  if (el.type === "number") {
    const n = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
    if (!Number.isNaN(n)) el.value = String(n);
  } else {
    el.value = fmt(path, value) ?? String(value);
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function highlightByConfidence(el, path, confidence = {}) {
  const c = confidence[path];
  // 기본 클래스 정리
  el.classList.remove("input-warning", "input-success", "select-warning", "select-success", "textarea-warning", "textarea-success", "border-yellow-400", "border-green-500");

  const base = el.tagName === "SELECT" ? "select" : el.tagName === "TEXTAREA" ? "textarea" : "input";
  if (typeof c !== "number") return;

  if (c >= CONF_OK) {
    el.classList.add(`${base}-success`, "border-green-500");
    el.title = "신뢰도 높음";
  } else if (c >= CONF_WARN) {
    el.classList.add(`${base}-warning`, "border-yellow-400");
    el.title = "신뢰도 보통 — 제출 전 확인 권장";
  } else {
    // 낮은 신뢰도면 아예 채우지 않는 쪽을 권장하지만,
    // 여기선 표시만(필요시 값 제거 로직 추가 가능)
    el.classList.add(`${base}-warning`, "border-yellow-400");
    el.title = "신뢰도 낮음 — 값 확인 필요";
  }
}

function validateSoft(el, path) {
  // 간단한 소프트 검증: 사업자등록번호 체크섬
  if (path === "business.regNo" && validators.isValidBizRegNo) {
    const ok = validators.isValidBizRegNo(el.value);
    if (!ok && el.value) {
      el.classList.add("input-warning", "border-yellow-400");
      el.title = (el.title ? el.title + " · " : "") + "사업자등록번호 체크 필요";
    }
  }
}

function fillForm(entities) {
  const confidence = entities?.metadata?.confidence ?? {};
  const fields = document.querySelectorAll("[data-field]");
  fields.forEach((el) => {
    const path = el.getAttribute("data-field");
    const val = getByPath(entities, path);
    if (val == null) return; // 값이 없으면 스킵

    setFieldValue(el, path, val);
    highlightByConfidence(el, path, confidence);
    validateSoft(el, path);
  });
}

function showBanner() {
  const banner = document.getElementById("autofill-banner");
  if (!banner) return;
  banner.classList.remove("hidden");

  const accept = document.getElementById("autofill-accept");
  const reject = document.getElementById("autofill-reject");

  if (accept && !accept.dataset.bound) {
    accept.dataset.bound = "1";
    accept.addEventListener("click", () => {
      const entities = getPendingEntities();
      if (!entities) return;
      fillForm(entities);
      clearPendingEntities();
      banner.classList.add("hidden");
      toast("대화 내용으로 신청서가 채워졌습니다.");
    });
  }
  if (reject && !reject.dataset.bound) {
    reject.dataset.bound = "1";
    reject.addEventListener("click", () => {
      clearPendingEntities();
      banner.classList.add("hidden");
      toast("자동채움을 건너뛰었습니다.");
    });
  }
}

function toast(msg) {
  // DaisyUI 없이도 동작하는 초미니 토스트
  const t = document.createElement("div");
  t.textContent = msg;
  t.className = "fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-sm px-4 py-2 rounded-lg shadow-lg opacity-90 z-50";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function maybeShowBanner() {
  const entities = getPendingEntities();
  if (!entities) return;
  // 엔터티에 채울 값이 있으면 배너 노출
  showBanner();
}

// 초기 진입/이벤트 훅
addEventListener("DOMContentLoaded", maybeShowBanner);
addEventListener("entities:ready", maybeShowBanner);   // 챗봇이 새 엔터티를 넣었을 때
addEventListener("entities:cleared", () => {
  const banner = document.getElementById("autofill-banner");
  banner?.classList.add("hidden");
});
addEventListener("storage", () => {  // 다른 탭/iframe에서 엔터티 갱신 → 배너 표시
  try { maybeShowBanner(); } catch {}
});
*/
