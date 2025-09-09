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
