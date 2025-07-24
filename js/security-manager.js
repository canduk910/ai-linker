// SecurityManager - 보안 관련 기능 담당
export class SecurityManager {
    constructor(config) {
        this.config = config;
        this.rateLimitMap = new Map();
        this.securityEvents = [];
        this.setupCleanupInterval();
    }

    sanitizeInput(input) {
        if (typeof input !== 'string') {
            return '';
        }

        // HTML 태그 제거
        let sanitized = input.replace(/<[^>]*>/g, '');
        
        // 스크립트 관련 키워드 제거
        const dangerousPatterns = [
            /javascript:/gi,
            /vbscript:/gi,
            /onload/gi,
            /onerror/gi,
            /onclick/gi,
            /onmouseover/gi
        ];

        dangerousPatterns.forEach(pattern => {
            sanitized = sanitized.replace(pattern, '');
        });

        // 특수 문자 이스케이프
        sanitized = sanitized
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');

        return sanitized.trim();
    }

    validateMessage(message) {
        const errors = [];
        const sanitizedMessage = this.sanitizeInput(message);

        // 길이 검증
        if (!message || message.trim().length === 0) {
            errors.push('메시지가 비어있습니다.');
        } else if (message.length > this.config.maxMessageLength) {
            errors.push(`메시지는 ${this.config.maxMessageLength}자 이내로 입력해주세요.`);
        }

        // 악성 패턴 검사
        const maliciousPatterns = [
            /eval\s*\(/gi,
            /function\s*\(/gi,
            /setTimeout\s*\(/gi,
            /setInterval\s*\(/gi,
            /document\./gi,
            /window\./gi
        ];

        const hasMaliciousContent = maliciousPatterns.some(pattern => 
            pattern.test(message)
        );

        if (hasMaliciousContent) {
            errors.push('허용되지 않는 내용이 포함되어 있습니다.');
            this.logSecurityEvent({
                type: 'invalid_input',
                message: 'Malicious pattern detected',
                originalInput: message.substring(0, 100),
                timestamp: new Date()
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitizedMessage: errors.length === 0 ? sanitizedMessage : null
        };
    }

    checkRateLimit(userId = 'anonymous') {
        const now = Date.now();
        const windowStart = now - 60000; // 1분 전

        if (!this.rateLimitMap.has(userId)) {
            this.rateLimitMap.set(userId, []);
        }

        const userRequests = this.rateLimitMap.get(userId);
        
        // 1분 이전 요청들 제거
        const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);
        this.rateLimitMap.set(userId, recentRequests);

        // 요청 수 확인
        if (recentRequests.length >= this.config.rateLimitPerMinute) {
            this.logSecurityEvent({
                type: 'rate_limit',
                userId,
                message: `Rate limit exceeded: ${recentRequests.length} requests in 1 minute`,
                timestamp: new Date()
            });
            return false;
        }

        // 현재 요청 추가
        recentRequests.push(now);
        this.rateLimitMap.set(userId, recentRequests);
        
        return true;
    }

    encryptApiKey(apiKey) {
        // 간단한 XOR 암호화 (실제 환경에서는 더 강력한 암호화 사용)
        const key = this.config.encryptionKey;
        let encrypted = '';
        
        for (let i = 0; i < apiKey.length; i++) {
            const keyChar = key.charCodeAt(i % key.length);
            const apiChar = apiKey.charCodeAt(i);
            encrypted += String.fromCharCode(apiChar ^ keyChar);
        }
        
        return btoa(encrypted); // Base64 인코딩
    }

    decryptApiKey(encryptedKey) {
        try {
            const encrypted = atob(encryptedKey); // Base64 디코딩
            const key = this.config.encryptionKey;
            let decrypted = '';
            
            for (let i = 0; i < encrypted.length; i++) {
                const keyChar = key.charCodeAt(i % key.length);
                const encChar = encrypted.charCodeAt(i);
                decrypted += String.fromCharCode(encChar ^ keyChar);
            }
            
            return decrypted;
        } catch (error) {
            console.error('Failed to decrypt API key:', error);
            return null;
        }
    }

    logSecurityEvent(event) {
        const securityEvent = {
            id: Date.now() + Math.random(),
            ...event,
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        this.securityEvents.push(securityEvent);
        
        // 최대 1000개 이벤트만 보관
        if (this.securityEvents.length > 1000) {
            this.securityEvents = this.securityEvents.slice(-1000);
        }

        // 심각한 보안 이벤트는 즉시 로그
        if (event.type === 'invalid_input') {
            console.warn('Security Event:', securityEvent);
        }

        // 실제 환경에서는 서버로 전송
        // this.sendSecurityEventToServer(securityEvent);
    }

    getSecurityEvents(limit = 100) {
        return this.securityEvents.slice(-limit);
    }

    setupCleanupInterval() {
        // 5분마다 오래된 데이터 정리
        setInterval(() => {
            this.cleanupOldData();
        }, 5 * 60 * 1000);
    }

    cleanupOldData() {
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;

        // 오래된 rate limit 데이터 정리
        for (const [userId, requests] of this.rateLimitMap.entries()) {
            const recentRequests = requests.filter(timestamp => timestamp > fiveMinutesAgo);
            if (recentRequests.length === 0) {
                this.rateLimitMap.delete(userId);
            } else {
                this.rateLimitMap.set(userId, recentRequests);
            }
        }

        // 오래된 보안 이벤트 정리 (24시간 이상)
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        this.securityEvents = this.securityEvents.filter(
            event => event.timestamp.getTime() > oneDayAgo
        );
    }

    // 도메인 검증
    validateDomain() {
        const currentDomain = window.location.hostname;
        const isAllowed = this.config.allowedDomains.some(domain => 
            currentDomain === domain || currentDomain.endsWith('.' + domain)
        );

        if (!isAllowed) {
            this.logSecurityEvent({
                type: 'invalid_domain',
                message: `Unauthorized domain access: ${currentDomain}`,
                timestamp: new Date()
            });
        }

        return isAllowed;
    }

    // HTTPS 강제 확인
    enforceHTTPS() {
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            this.logSecurityEvent({
                type: 'insecure_connection',
                message: 'HTTP connection detected, redirecting to HTTPS',
                timestamp: new Date()
            });
            
            location.replace('https:' + window.location.href.substring(window.location.protocol.length));
            return false;
        }
        return true;
    }
}