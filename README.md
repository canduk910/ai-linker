# AI-Linker 챗봇 - OpenAI API 통합

## 개요
AI-Linker는 공식 기관용 AI 챗봇 서비스로, OpenAI GPT 모델을 기반으로 한 지능형 응답 시스템입니다.

## 주요 기능

### 🤖 OpenAI API 통합
- GPT-5 모델 기반 지능형 응답
- 컨텍스트 유지 대화 지원
- 폴백 응답 시스템으로 안정성 보장

### 🔒 보안 강화
- 입력 데이터 검증 및 새니타이징
- XSS 및 악성 스크립트 방지
- 요청 속도 제한 (Rate Limiting)
- HTTPS 강제 사용
- API 키 암호화 저장

### 💬 대화 관리
- 세션 기반 컨텍스트 관리
- 대화 히스토리 자동 정리
- 로컬 스토리지 백업/복원
- 세션 타임아웃 관리

### 🎨 사용자 인터페이스
- DaisyUI 기반 반응형 디자인
- 실시간 타이핑 인디케이터
- 오류 처리 및 재시도 기능
- 접근성 및 다크모드 지원

## 파일 구조
```
/workspace/website/
├── index.html              # 메인 HTML 파일
├── css/
│   └── style.css          # 스타일시트
└── js/
    ├── script.js          # 메인 스크립트 (통합)
    ├── config-manager.js  # 설정 관리
    ├── security-manager.js # 보안 관리
    ├── conversation-manager.js # 대화 관리
    └── openai-service.js  # OpenAI API 서비스
```

## 설치 및 실행

### 1. 파일 배포
모든 파일을 웹 서버의 루트 디렉토리에 복사합니다.

### 2. OpenAI API 키 설정 (선택사항)
브라우저 개발자 도구 콘솔에서 다음 명령어를 실행:
```javascript
window.chatBotManager.setApiKey('your-openai-api-key-here');
```

### 3. 웹 브라우저에서 접속
`index.html` 파일을 웹 브라우저에서 열거나 웹 서버를 통해 접속합니다.

## 사용법

### 기본 사용
1. 웹사이트에 접속
2. "챗봇 시작" 버튼 클릭 또는 상단 메뉴에서 "챗봇" 선택
3. 메시지 입력창에 질문 입력 (최대 500자)
4. Enter 키 또는 전송 버튼으로 메시지 전송

### 고급 기능
- **대화 초기화**: 휴지통 아이콘 클릭
- **서비스 상태 확인**: 정보 아이콘 클릭
- **오류 재시도**: 오류 발생 시 "다시 시도" 버튼 클릭

## API 설정

### OpenAI API 키 설정
```javascript
// 개발 환경에서 API 키 설정
window.chatBotManager.setApiKey('sk-your-api-key');

// 또는 ConfigManager를 통한 설정
const config = window.chatBotManager.configManager;
config.setApiKey('sk-your-api-key');
```

### 모델 설정 변경
```javascript
const config = window.chatBotManager.configManager;
config.updateConfig({
    openai: {
        model: 'gpt-5',
        maxTokens: 2000,
        temperature: 0.8
    }
});
```

## 보안 설정

### Rate Limiting 설정
```javascript
const config = window.chatBotManager.configManager;
config.updateConfig({
    security: {
        rateLimitPerMinute: 20,
        maxMessageLength: 1000
    }
});
```

### 허용 도메인 설정
```javascript
const config = window.chatBotManager.configManager;
config.updateConfig({
    security: {
        allowedDomains: ['yourdomain.com', 'subdomain.yourdomain.com']
    }
});
```

## 모니터링

### 서비스 상태 확인
```javascript
const status = window.chatBotManager.getServiceStatus();
console.log('Service Status:', status);
```

### 사용량 통계
```javascript
const usage = window.chatBotManager.openAIService.getUsageStats();
console.log('Usage Stats:', usage);
```

### 보안 이벤트 확인
```javascript
const events = window.chatBotManager.securityManager.getSecurityEvents();
console.log('Security Events:', events);
```

## 커스터마이징

### 시스템 프롬프트 변경
```javascript
const systemPrompt = `
당신은 [기관명]의 공식 AI 상담사입니다.
다음 역할을 수행해주세요:
1. 정중하고 전문적인 응답
2. 정확한 정보 제공
3. 불확실한 경우 명확히 안내
`;

window.chatBotManager.openAIService.setSystemPrompt(systemPrompt);
```

### UI 테마 변경
HTML 파일의 `data-theme` 속성을 수정:
```html
<html lang="ko" data-theme="dark">
```

## 문제 해결

### 일반적인 문제
1. **API 키 오류**: OpenAI API 키가 올바른지 확인
2. **네트워크 오류**: 인터넷 연결 및 CORS 설정 확인
3. **Rate Limit**: 요청 속도를 줄이거나 잠시 대기

### 디버깅
브라우저 개발자 도구 콘솔에서 상세한 로그를 확인할 수 있습니다.

### 로그 레벨 설정
```javascript
// 상세한 디버그 정보 출력
window.chatBotManager.errorHandler.logLevel = 'debug';
```

- 전화: 1588-0000 (평일 09:00-18:00)

## 업데이트 내역
- v2.0.0: OpenAI API 통합 및 보안 강화
- v1.0.0: 기본 챗봇 기능 구현
