// /js/store/entities.js
const KEY = "aiLinker.pendingEntities.v1"; // 세션 스코프 키

export function setPendingEntities(entities, ttlSec = 15 * 60) {
  // 최소한의 스키마 유효성
  if (!entities || typeof entities !== "object") return;
  const expiresAt = Date.now() + ttlSec * 1000;
  const payload = { data: entities, expiresAt };
  sessionStorage.setItem(KEY, JSON.stringify(payload));
  // 새 엔터티 알림(다른 탭/페이지도 받을 수 있게)
  dispatchEvent(new CustomEvent("entities:ready"));
}

export function getPendingEntities() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (!expiresAt || Date.now() > expiresAt) {
      clearPendingEntities();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearPendingEntities() {
  sessionStorage.removeItem(KEY);
  dispatchEvent(new CustomEvent("entities:cleared"));
}

// 대충이라도 채울 값이 있는지 판단(대표 필드 몇 개만)
export function hasUseful(entities) {
  const paths = [
    "borrower.name",
    "borrower.phone",
    "business.name",
    "business.regNo",
    "business.address",
    "loan.purpose",
    "loan.desiredAmountKRW",
  ];
  return paths.some((p) => getByPath(entities, p) != null);
}

function getByPath(obj, path) {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}
