// OpenAIService - OpenAI API와의 통신 담당
export class OpenAIService {
    constructor(config) {
        this.config = config;
        this.usageStats = {
            tokensUsed: 0,
            requestCount: 0,
            lastRequest: null,
            errors: 0
        };
        this.isInitialized = false;
    }

    async initialize() {
        try {
            if (this.config.apiKey) {
                const isValid = await this.validateApiKey();
                if (isValid) {
                    this.isInitialized = true;
                    console.log('OpenAI Service initialized successfully');
                } else {
                    throw new Error('Invalid API key');
                }
            } else {
                console.warn('OpenAI API key not provided - using fallback responses');
                this.isInitialized = false;
            }
        } catch (error) {
            console.error('OpenAI Service initialization failed:', error);
            this.isInitialized = false;
        }
    }

    async validateApiKey() {
        if (!this.config.apiKey) {
            return false;
        }

        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            return response.ok;
        } catch (error) {
            console.error('API key validation failed:', error);
            return false;
        }
    }

    async sendMessage(message, context = null) {
        if (!this.isInitialized) {
            return this.getFallbackResponse(message);
        }

        try {
            this.usageStats.requestCount++;
            this.usageStats.lastRequest = new Date();

            const messages = this.prepareMessages(message, context);
            const response = await this.callOpenAI(messages);
            
            if (response.usage) {
                this.usageStats.tokensUsed += response.usage.total_tokens || 0;
            }

            return response.choices[0]?.message?.content || this.getFallbackResponse(message);

        } catch (error) {
            console.error('OpenAI API call failed:', error);
            this.usageStats.errors++;
            return this.handleAPIError(error, message);
        }
    }

    prepareMessages(message, context) {
        const messages = [];

        // 시스템 프롬프트 추가
        if (this.config.systemPrompt) {
            messages.push({
                role: 'system',
                content: this.config.systemPrompt
            });
        }

        // 대화 컨텍스트 추가
        if (context && context.messages) {
            // 시스템 메시지가 이미 있는지 확인
            const contextMessages = context.messages.filter(msg => 
                !(msg.role === 'system' && this.config.systemPrompt)
            );
            messages.push(...contextMessages);
        }

        // 현재 사용자 메시지 추가
        messages.push({
            role: 'user',
            content: message
        });

        return messages;
    }

    async callOpenAI(messages) {
        const requestBody = {
            model: this.config.model,
            messages: messages,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            stream: false
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API Error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
            }

            return await response.json();

        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    handleAPIError(error, originalMessage) {
        console.error('OpenAI API Error:', error);

        // 에러 타입별 처리
        if (error.name === 'AbortError') {
            return '응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
        }

        if (error.message.includes('401')) {
            return '인증 오류가 발생했습니다. 관리자에게 문의해주세요.';
        }

        if (error.message.includes('429')) {
            return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        }

        if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            return 'AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }

        // 폴백 응답 반환
        return this.getFallbackResponse(originalMessage);
    }

    getFallbackResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        // 기본 응답 패턴
        const responses = new Map([
            ['안녕', '안녕하세요! AI-Linker입니다. 무엇을 도와드릴까요?'],
            ['안녕하세요', '안녕하세요! AI-Linker입니다. 어떤 도움이 필요하신가요?'],
            ['도움말', '도움이 필요하시군요! 다음과 같은 서비스를 제공합니다:\n• 행정 서비스 안내\n• 신청 절차 설명\n• 필요 서류 안내\n• 운영 시간 문의\n• 기타 공식 기관 관련 정보'],
            ['시간', '저희 서비스는 24시간 운영됩니다. 언제든지 문의해주세요!'],
            ['운영시간', '저희 서비스는 24시간 운영됩니다. 언제든지 문의해주세요!'],
            ['서류', '필요한 서류는 서비스 종류에 따라 다릅니다. 구체적으로 어떤 서비스에 대해 문의하시나요?'],
            ['신청', '신청 절차에 대해 안내해드리겠습니다. 어떤 서비스 신청을 원하시나요?'],
            ['문의', '추가 문의사항이 있으시면 전화(1588-0000) 또는 이메일(support@ai-linker.kr)로 연락주세요.'],
            ['감사', '도움이 되었다니 기쁩니다! 또 다른 궁금한 점이 있으시면 언제든 말씀해주세요.'],
            ['고마워', '천만에요! 더 궁금한 것이 있으시면 언제든 물어보세요.'],
            ['처음', '처음 이용하시는군요! AI-Linker는 공식 기관의 다양한 서비스에 대해 안내해드립니다. 궁금한 것이 있으시면 자연스럽게 질문해주세요.'],
            ['기능', 'AI-Linker의 주요 기능은 다음과 같습니다:\n• 24시간 상담 서비스\n• 정확한 공식 정보 제공\n• 빠른 AI 응답\n• 다양한 행정 서비스 안내']
        ]);

        // 키워드 매칭
        for (const [keyword, response] of responses) {
            if (lowerMessage.includes(keyword)) {
                return response;
            }
        }

        // 기본 응답
        return '죄송합니다. 현재 AI 서비스에 일시적인 문제가 있어 정확한 답변을 드리기 어렵습니다. 더 구체적으로 질문해주시거나 전화 상담(1588-0000)을 이용해주세요.';
    }

    setSystemPrompt(prompt) {
        this.config.systemPrompt = prompt;
    }

    getUsageStats() {
        return { ...this.usageStats };
    }

    resetUsageStats() {
        this.usageStats = {
            tokensUsed: 0,
            requestCount: 0,
            lastRequest: null,
            errors: 0
        };
    }

    // 스트리밍 응답 지원 (향후 확장용)
    async sendMessageStream(message, context = null, onChunk = null) {
        if (!this.isInitialized) {
            const response = this.getFallbackResponse(message);
            if (onChunk) {
                // 스트리밍 시뮬레이션
                for (let i = 0; i < response.length; i += 10) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    onChunk(response.slice(i, i + 10));
                }
            }
            return response;
        }

        // 실제 스트리밍 구현은 여기에...
        // 현재는 일반 응답으로 폴백
        return await this.sendMessage(message, context);
    }

    // 모델 정보 가져오기
    async getAvailableModels() {
        if (!this.isInitialized) {
            return [];
        }

        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.data || [];
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
        }

        return [];
    }

    // 서비스 상태 확인
    getServiceStatus() {
        return {
            initialized: this.isInitialized,
            hasApiKey: !!this.config.apiKey,
            model: this.config.model,
            lastRequest: this.usageStats.lastRequest,
            totalRequests: this.usageStats.requestCount,
            totalErrors: this.usageStats.errors,
            errorRate: this.usageStats.requestCount > 0 ? 
                (this.usageStats.errors / this.usageStats.requestCount * 100).toFixed(2) + '%' : '0%'
        };
    }
}