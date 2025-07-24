// ConversationManager - 대화 세션 및 컨텍스트 관리
export class ConversationManager {
    constructor(maxHistory = 20, sessionTimeout = 30 * 60 * 1000) {
        this.sessions = new Map();
        this.maxHistory = maxHistory;
        this.sessionTimeout = sessionTimeout;
        this.setupCleanupInterval();
    }

    createSession(userId = null) {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            userId,
            messages: [],
            createdAt: new Date(),
            lastActivity: new Date()
        };

        this.sessions.set(sessionId, session);
        return sessionId;
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    addMessage(sessionId, message) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        const chatMessage = {
            role: message.role || 'user',
            content: message.content,
            timestamp: new Date(),
            id: Date.now() + Math.random()
        };

        session.messages.push(chatMessage);
        session.lastActivity = new Date();

        // 메시지 히스토리 제한
        if (session.messages.length > this.maxHistory) {
            // 시스템 메시지는 유지하고 오래된 대화만 제거
            const systemMessages = session.messages.filter(msg => msg.role === 'system');
            const otherMessages = session.messages.filter(msg => msg.role !== 'system');
            
            if (otherMessages.length > this.maxHistory - systemMessages.length) {
                const keepCount = this.maxHistory - systemMessages.length;
                const recentMessages = otherMessages.slice(-keepCount);
                session.messages = [...systemMessages, ...recentMessages];
            }
        }

        return chatMessage;
    }

    getContext(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        session.lastActivity = new Date();
        
        return {
            sessionId: session.id,
            userId: session.userId,
            messages: [...session.messages],
            createdAt: session.createdAt,
            lastActivity: session.lastActivity
        };
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    clearSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.messages = [];
            session.lastActivity = new Date();
            return true;
        }
        return false;
    }

    deleteSession(sessionId) {
        return this.sessions.delete(sessionId);
    }

    // 대화 히스토리를 OpenAI API 형식으로 변환
    getMessagesForAPI(sessionId, includeSystemPrompt = true) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return [];
        }

        const messages = [...session.messages];

        // 시스템 프롬프트가 없고 포함해야 하는 경우 추가
        const hasSystemMessage = messages.some(msg => msg.role === 'system');
        if (includeSystemPrompt && !hasSystemMessage) {
            messages.unshift({
                role: 'system',
                content: '당신은 AI-Linker라는 공식 기관용 AI 챗봇입니다. 정중하고 전문적으로 응답해주세요.',
                timestamp: new Date()
            });
        }

        // OpenAI API 형식으로 변환
        return messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    // 세션 통계
    getSessionStats(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        const messagesByRole = session.messages.reduce((acc, msg) => {
            acc[msg.role] = (acc[msg.role] || 0) + 1;
            return acc;
        }, {});

        const duration = Date.now() - session.createdAt.getTime();
        const timeSinceLastActivity = Date.now() - session.lastActivity.getTime();

        return {
            sessionId: session.id,
            messageCount: session.messages.length,
            messagesByRole,
            duration,
            timeSinceLastActivity,
            isActive: timeSinceLastActivity < this.sessionTimeout
        };
    }

    // 모든 세션 통계
    getAllSessionsStats() {
        const stats = {
            totalSessions: this.sessions.size,
            activeSessions: 0,
            totalMessages: 0,
            oldestSession: null,
            newestSession: null
        };

        let oldestTime = Date.now();
        let newestTime = 0;

        for (const session of this.sessions.values()) {
            const timeSinceLastActivity = Date.now() - session.lastActivity.getTime();
            
            if (timeSinceLastActivity < this.sessionTimeout) {
                stats.activeSessions++;
            }

            stats.totalMessages += session.messages.length;

            if (session.createdAt.getTime() < oldestTime) {
                oldestTime = session.createdAt.getTime();
                stats.oldestSession = session.id;
            }

            if (session.createdAt.getTime() > newestTime) {
                newestTime = session.createdAt.getTime();
                stats.newestSession = session.id;
            }
        }

        return stats;
    }

    pruneOldSessions() {
        const now = Date.now();
        let prunedCount = 0;

        for (const [sessionId, session] of this.sessions.entries()) {
            const timeSinceLastActivity = now - session.lastActivity.getTime();
            
            if (timeSinceLastActivity > this.sessionTimeout) {
                this.sessions.delete(sessionId);
                prunedCount++;
            }
        }

        if (prunedCount > 0) {
            console.log(`Pruned ${prunedCount} inactive sessions`);
        }

        return prunedCount;
    }

    setupCleanupInterval() {
        // 10분마다 오래된 세션 정리
        setInterval(() => {
            this.pruneOldSessions();
        }, 10 * 60 * 1000);
    }

    // 세션 백업 (로컬 스토리지)
    backupSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        try {
            const backup = {
                ...session,
                createdAt: session.createdAt.toISOString(),
                lastActivity: session.lastActivity.toISOString(),
                messages: session.messages.map(msg => ({
                    ...msg,
                    timestamp: msg.timestamp.toISOString()
                }))
            };

            localStorage.setItem(`ai_linker_session_${sessionId}`, JSON.stringify(backup));
            return true;
        } catch (error) {
            console.error('Failed to backup session:', error);
            return false;
        }
    }

    // 세션 복원 (로컬 스토리지)
    restoreSession(sessionId) {
        try {
            const backupData = localStorage.getItem(`ai_linker_session_${sessionId}`);
            if (!backupData) {
                return false;
            }

            const backup = JSON.parse(backupData);
            const session = {
                ...backup,
                createdAt: new Date(backup.createdAt),
                lastActivity: new Date(backup.lastActivity),
                messages: backup.messages.map(msg => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                }))
            };

            this.sessions.set(sessionId, session);
            return true;
        } catch (error) {
            console.error('Failed to restore session:', error);
            return false;
        }
    }

    // 현재 활성 세션 ID 가져오기 (가장 최근 활동)
    getCurrentSessionId() {
        let mostRecentSession = null;
        let mostRecentTime = 0;

        for (const session of this.sessions.values()) {
            if (session.lastActivity.getTime() > mostRecentTime) {
                mostRecentTime = session.lastActivity.getTime();
                mostRecentSession = session;
            }
        }

        return mostRecentSession ? mostRecentSession.id : null;
    }
}