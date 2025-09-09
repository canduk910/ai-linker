<script>
// UMD-lite: 전역 네임스페이스 보장
(function (root) {
  const NS_SCHEMAS = (root.aiLinkerSchemas ||= {});
  const NS_VALIDATORS = (root.aiLinkerValidators ||= {});
  const NS_FORMATTERS = (root.aiLinkerFormat ||= {});

  // 1) 표준 스키마
  NS_SCHEMAS.loanApplicationV1 = {
    borrower: {
      name: null,           // 대표자 성명
      birthDate: null,      // YYYY-MM-DD
      phone: null,
      email: null,
      idType: null          // "RID" | "DL"
    },
    business: {
      name: null,           // 상호
      regNo: null,          // 사업자번호(10자리)
      type: null,           // "개인" | "법인"
      establishedOn: null,  // YYYY-MM-DD
      address: null,
      industry: null,
      monthlySalesKRW: null
    },
    loan: {
      purpose: null,            // 운전자금/시설자금 등
      desiredAmountKRW: null,
      desiredTermMonths: null,
      collateralType: null      // "보증서" | "무담보" | "부동산"
    },
    metadata: { source: "chat", confidence: {}, updatedAt: null }
  };

  // 2) 검증 유틸: 사업자등록번호 체크섬
  NS_VALIDATORS.isValidBizRegNo = function (raw) {
    const digits = (raw || "").replace(/[^0-9]/g, "");
    if (digits.length !== 10) return false;
    const w = [1,3,7,1,3,7,1,3,5];
    const sum = w.reduce((acc, wi, i) => acc + (parseInt(digits[i],10)*wi), 0)
               + Math.floor((parseInt(digits[8],10)*5)/10);
    return ((10 - (sum % 10)) % 10) === parseInt(digits[9],10);
  };

  // 3) 포맷터(입력칸 채움용)
  NS_FORMATTERS.forInput = function(path, val){
    if (val == null) return "";
    if (path === "business.regNo") {
      const d = String(val).replace(/[^0-9]/g,"");
      return d.length===10 ? `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}` : val;
    }
    if (path.endsWith("AmountKRW")) {
      const n = Number(val); if (Number.isFinite(n)) return n.toLocaleString("ko-KR");
    }
    return String(val);
  };
})(window);
</script>
