// ConfigManager - 설정 및 환경 변수 관리
export class ConfigManager {
    constructor() {
        this.config = this.loadDefaultConfig();
        this.validateConfig();
    }

    loadDefaultConfig() {
        return {
            openai: {
                apiKey: '', // 실제 환경에서는 환경변수나 보안 저장소에서 로드
                model: 'gpt-3.5-turbo',
                maxTokens: 1000,
                temperature: 0.7,
                timeout: 30000,
                systemPrompt: `당신은 AI-Linker라는 공식 기관용 AI 챗봇입니다. 
다음 역할을 수행해주세요:
1. 정중하고 전문적인 톤으로 응답
2. 공식 기관의 서비스와 절차에 대한 정확한 정보 제공
3. 불확실한 정보는 명확히 구분하여 안내
4. 추가 문의가 필요한 경우 연락처 안내
5. 한국어로 자연스럽게 응답

연락처 정보:
- 전화: 1588-0000 (평일 09:00-18:00)
- 이메일: support@ai-linker.kr`
            },
            security: {
                maxMessageLength: 500,
                rateLimitPerMinute: 10,
                allowedDomains: ['localhost', 'ai-linker.kr'],
                encryptionKey: 'default-key-change-in-production',
                sessionTimeout: 30 * 60 * 1000 // 30분
            },
            ui: {
                typingDelay: 1000,
                maxRetryAttempts: 3,
                autoScrollDelay: 100
            }
        };
    }

    getOpenAIConfig() {
        return { ...this.config.openai };
    }

    getSecurityConfig() {
        return { ...this.config.security };
    }

    getUIConfig() {
        return { ...this.config.ui };
    }

    validateConfig() {
        const required = ['openai', 'security', 'ui'];
        const missing = required.filter(key => !this.config[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required config sections: ${missing.join(', ')}`);
        }

        // OpenAI 설정 검증
        if (!this.config.openai.model) {
            console.warn('OpenAI model not specified, using default');
        }

        return true;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.validateConfig();
    }

    // 개발 환경에서 API 키 설정 (실제 환경에서는 보안 저장소 사용)
    setApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('Invalid API key provided');
        }
        this.config.openai.apiKey = apiKey;
    }

    hasValidApiKey() {
        return this.config.openai.apiKey && this.config.openai.apiKey.length > 0;
    }
}