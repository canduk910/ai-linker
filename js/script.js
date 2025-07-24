// AI-Linker 챗봇 웹사이트 - OpenAI API 통합 및 보안 강화

import { ConfigManager } from './config-manager.js';
import { SecurityManager } from './security-manager.js';
import { ConversationManager } from './conversation-manager.js';
import { OpenAIService } from './openai-service.js';
import { ImageManager, imageManager } from './image-manager.js';

// 설정 및 상수
const CONFIG = {
    maxMessageLength: 500,
    typingDelay: 1000,
    retryAttempts: 3,
    errorMessages: {
        network: '네트워크 연결을 확인해주세요.',
        general: '일시적인 오류가 발생했습니다. 다시 시도해주세요.',
        timeout: '응답 시간이 초과되었습니다.',
        initialization: '챗봇 초기화 중 오류가 발생했습니다.',
        rateLimit: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        invalidInput: '입력 내용에 문제가 있습니다. 다시 확인해주세요.',
        imageLoad: '이미지를 불러올 수 없습니다. 기본 이미지로 대체됩니다.'
    }
};

// 챗봇 상태 관리 클래스 (기존 유지, 일부 수정)
class ChatState {
    constructor() {
        this.messages = [];
        this.isProcessing = false;
        this.currentScreen = 'home';
        this.messageCounter = 0;
        this.currentSessionId = null;
    }

    addMessage(content, sender, status = 'sent') {
        const message = {
            id: ++this.messageCounter,
            content,
            sender,
            timestamp: new Date(),
            status
        };
        this.messages.push(message);
        return message;
    }

    getMessages() {
        return [...this.messages];
    }

    setProcessing(status) {
        this.isProcessing = status;
    }

    isCurrentlyProcessing() {
        return this.isProcessing;
    }

    getCurrentScreen() {
        return this.currentScreen;
    }

    setCurrentScreen(screen) {
        this.currentScreen = screen;
    }

    clearMessages() {
        this.messages = [];
        this.messageCounter = 0;
    }

    getLastMessage() {
        return this.messages[this.messages.length - 1] || null;
    }

    setCurrentSessionId(sessionId) {
        this.currentSessionId = sessionId;
    }

    getCurrentSessionId() {
        return this.currentSessionId;
    }
}

// 향상된 오류 처리 클래스
class EnhancedErrorHandler {
    constructor() {
        this.lastAction = null;
        this.retryCount = 0;
        this.setupGlobalErrorHandling();
        this.setupImageErrorHandling();
    }

    setupGlobalErrorHandling() {
        // 전역 오류 처리
        window.addEventListener('error', (event) => {
            this.logError(event.error, 'Global Error');
            this.showUserFriendlyError(CONFIG.errorMessages.general);
        });

        // Promise rejection 처리
        window.addEventListener('unhandledrejection', (event) => {
            this.logError(event.reason, 'Unhandled Promise Rejection');
            this.showUserFriendlyError(CONFIG.errorMessages.general);
            event.preventDefault();
        });
    }

    setupImageErrorHandling() {
        // 이미지 로드 오류 이벤트 리스너
        document.addEventListener('imageLoadError', (event) => {
            console.warn('이미지 로드 오류:', event.detail);
            // 필요시 사용자에게 알림 (선택적)
            // this.showUserFriendlyError(CONFIG.errorMessages.imageLoad, false);
        });
    }

    logError(error, context) {
        const timestamp = new Date().toISOString();
        const errorInfo = {
            timestamp,
            context,
            message: error?.message || 'Unknown error',
            stack: error?.stack || 'No stack trace',
            userAgent: navigator.userAgent,
            url: window.location.href,
            retryCount: this.retryCount
        };
        
        console.error('Error logged:', errorInfo);
    }

    showUserFriendlyError(message, showRetry = true) {
        try {
            const errorModal = document.getElementById('error-modal');
            const errorMessage = document.getElementById('error-message');
            
            if (errorModal && errorMessage) {
                errorMessage.textContent = message;
                errorModal.classList.add('modal-open');
                
                const retryButton = errorModal.querySelector('.btn-outline');
                if (retryButton) {
                    retryButton.style.display = showRetry ? 'inline-flex' : 'none';
                }
            } else {
                alert(message);
            }
        } catch (e) {
            console.error('Error showing error modal:', e);
            alert(message);
        }
    }

    setLastAction(action, data = null) {
        this.lastAction = { action, data, timestamp: Date.now() };
        this.retryCount = 0;
    }

    retryLastAction() {
        if (!this.lastAction || this.retryCount >= CONFIG.retryAttempts) {
            this.showUserFriendlyError('재시도 횟수를 초과했습니다.', false);
            return false;
        }

        this.retryCount++;
        
        try {
            switch (this.lastAction.action) {
                case 'sendMessage':
                    if (window.chatBotManager) {
                        window.chatBotManager.messageHandler.sendMessage(this.lastAction.data);
                    }
                    break;
                case 'showScreen':
                    if (window.chatBotManager) {
                        window.chatBotManager.showScreen(this.lastAction.data);
                    }
                    break;
                default:
                    return false;
            }
            return true;
        } catch (error) {
            this.logError(error, 'Retry Action');
            return false;
        }
    }
}

// UI 관리 클래스 (기존 유지)
class UIManager {
    constructor() {
        this.elements = new Map();
        this.init();
    }

    init() {
        const elementIds = [
            'chat-input',
            'chat-messages',
            'error-modal',
            'error-message',
            'home-screen',
            'chat-screen',
            'service-screen',
            'contact-screen',
            'help-screen'
        ];

        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.elements.set(id, element);
            }
        });
    }

    getElement(id) {
        let element = this.elements.get(id);
        if (!element) {
            element = document.getElementById(id);
            if (element) {
                this.elements.set(id, element);
            }
        }
        return element;
    }

    showScreen(screenId) {
        try {
            this.hideAllScreens();
            
            const targetScreen = this.getElement(`${screenId}-screen`);
            if (targetScreen) {
                targetScreen.classList.add('active');
                this.updateNavigation(screenId);
                return true;
            } else {
                throw new Error(`Screen not found: ${screenId}`);
            }
        } catch (error) {
            console.error('Screen navigation error:', error);
            return false;
        }
    }

    hideAllScreens() {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            screen.classList.remove('active');
        });
    }

    updateNavigation(activeScreen) {
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.dataset.screen === activeScreen) {
                link.classList.add('active');
            }
        });
    }

    scrollToBottom() {
        const messagesContainer = this.getElement('chat-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    focusChatInput() {
        const chatInput = this.getElement('chat-input');
        if (chatInput) {
            chatInput.focus();
        }
    }

    clearChatInput() {
        const chatInput = this.getElement('chat-input');
        if (chatInput) {
            chatInput.value = '';
        }
    }
}

// 향상된 메시지 처리 클래스
class EnhancedMessageHandler {
    constructor(chatState, uiManager, errorHandler, openAIService, securityManager, conversationManager) {
        this.chatState = chatState;
        this.uiManager = uiManager;
        this.errorHandler = errorHandler;
        this.openAIService = openAIService;
        this.securityManager = securityManager;
        this.conversationManager = conversationManager;
    }

    async sendMessage(content) {
        if (this.chatState.isCurrentlyProcessing()) {
            return;
        }

        try {
            if (!content || content.trim().length === 0) {
                return;
            }

            // 보안 검증
            const validation = this.securityManager.validateMessage(content);
            if (!validation.isValid) {
                this.errorHandler.showUserFriendlyError(
                    validation.errors.join(' '), false
                );
                return;
            }

            // Rate limiting 확인
            if (!this.securityManager.checkRateLimit()) {
                this.errorHandler.showUserFriendlyError(CONFIG.errorMessages.rateLimit, false);
                return;
            }

            this.errorHandler.setLastAction('sendMessage', content);
            this.chatState.setProcessing(true);
            
            // 사용자 메시지 추가
            this.addUserMessage(validation.sanitizedMessage);
            this.uiManager.clearChatInput();
            
            // 세션 관리
            let sessionId = this.chatState.getCurrentSessionId();
            if (!sessionId) {
                sessionId = this.conversationManager.createSession();
                this.chatState.setCurrentSessionId(sessionId);
            }

            // 대화 히스토리에 사용자 메시지 추가
            this.conversationManager.addMessage(sessionId, {
                role: 'user',
                content: validation.sanitizedMessage
            });

            // 타이핑 인디케이터 표시
            this.showTypingIndicator();
            
            // AI 응답 생성
            await this.processWithAI(validation.sanitizedMessage, sessionId);
            
        } catch (error) {
            this.errorHandler.logError(error, 'Send Message');
            this.errorHandler.showUserFriendlyError(CONFIG.errorMessages.general);
        } finally {
            this.chatState.setProcessing(false);
        }
    }

    async processWithAI(message, sessionId) {
        try {
            const context = this.conversationManager.getContext(sessionId);
            const response = await this.openAIService.sendMessage(message, context);
            
            this.hideTypingIndicator();
            this.addBotMessage(response);
            
            // 대화 히스토리에 AI 응답 추가
            this.conversationManager.addMessage(sessionId, {
                role: 'assistant',
                content: response
            });

        } catch (error) {
            this.hideTypingIndicator();
            this.errorHandler.logError(error, 'Process with AI');
            
            const errorResponse = this.handleAPIError(error);
            this.addBotMessage(errorResponse);
        }
    }

    handleAPIError(error) {
        console.error('API Error:', error);
        
        if (error.message.includes('rate limit')) {
            return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        }
        
        if (error.message.includes('timeout')) {
            return '응답 시간이 초과되었습니다. 다시 시도해주세요.';
        }
        
        return '죄송합니다. 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
    }

    addUserMessage(content) {
        try {
            const message = this.chatState.addMessage(content, 'user');
            const messageElement = this.createMessageElement(content, 'user');
            
            const messagesContainer = this.uiManager.getElement('chat-messages');
            if (messagesContainer) {
                messagesContainer.appendChild(messageElement);
                this.uiManager.scrollToBottom();
            }
        } catch (error) {
            this.errorHandler.logError(error, 'Add User Message');
        }
    }

    addBotMessage(content) {
        try {
            const message = this.chatState.addMessage(content, 'bot');
            const messageElement = this.createMessageElement(content, 'bot');
            
            const messagesContainer = this.uiManager.getElement('chat-messages');
            if (messagesContainer) {
                messagesContainer.appendChild(messageElement);
                this.uiManager.scrollToBottom();
            }
        } catch (error) {
            this.errorHandler.logError(error, 'Add Bot Message');
        }
    }

    createMessageElement(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat ${sender === 'user' ? 'chat-end' : 'chat-start'}`;
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'chat-image avatar';
        
        const avatarInner = document.createElement('div');
        avatarInner.className = `w-10 rounded-full ${sender === 'user' ? 'bg-secondary' : 'bg-primary'} flex items-center justify-center`;
        
        // 이미지 매니저를 사용하여 아바타 아이콘 생성
        const avatarIcon = document.createElement('div');
        avatarIcon.className = 'w-6 h-6 text-white';
        
        if (sender === 'user') {
            avatarIcon.innerHTML = imageManager.generateUserIcon(24);
        } else {
            avatarIcon.innerHTML = imageManager.generateBotIcon(24);
        }
        
        avatarInner.appendChild(avatarIcon);
        avatarDiv.appendChild(avatarInner);
        
        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = `chat-bubble ${sender === 'user' ? 'chat-bubble-secondary' : 'chat-bubble-primary'}`;
        
        // 줄바꿈 처리
        const formattedMessage = message.replace(/\n/g, '<br>');
        bubbleDiv.innerHTML = formattedMessage;
        
        messageDiv.appendChild(avatarDiv);
        messageDiv.appendChild(bubbleDiv);
        
        return messageDiv;
    }

    showTypingIndicator() {
        try {
            const messagesContainer = this.uiManager.getElement('chat-messages');
            if (!messagesContainer) return;
            
            this.hideTypingIndicator();
            
            const typingDiv = document.createElement('div');
            typingDiv.className = 'chat chat-start';
            typingDiv.id = 'typing-indicator';
            
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'chat-image avatar';
            
            const avatarInner = document.createElement('div');
            avatarInner.className = 'w-10 rounded-full bg-primary flex items-center justify-center';
            
            const avatarIcon = document.createElement('div');
            avatarIcon.className = 'w-6 h-6 text-white';
            avatarIcon.innerHTML = imageManager.generateBotIcon(24);
            
            avatarInner.appendChild(avatarIcon);
            avatarDiv.appendChild(avatarInner);
            
            const bubbleDiv = document.createElement('div');
            bubbleDiv.className = 'chat-bubble chat-bubble-primary';
            bubbleDiv.innerHTML = '<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
            
            typingDiv.appendChild(avatarDiv);
            typingDiv.appendChild(bubbleDiv);
            
            messagesContainer.appendChild(typingDiv);
            this.uiManager.scrollToBottom();
        } catch (error) {
            this.errorHandler.logError(error, 'Show Typing Indicator');
        }
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    clearMessages() {
        try {
            const messagesContainer = this.uiManager.getElement('chat-messages');
            if (!messagesContainer) return;
            
            messagesContainer.innerHTML = '';
            
            const initialMessage = this.createMessageElement('안녕하세요! AI-Linker입니다. 무엇을 도와드릴까요?', 'bot');
            messagesContainer.appendChild(initialMessage);
            
            this.chatState.clearMessages();
            this.chatState.addMessage('안녕하세요! AI-Linker입니다. 무엇을 도와드릴까요?', 'bot');
            
            // 새 세션 생성
            const newSessionId = this.conversationManager.createSession();
            this.chatState.setCurrentSessionId(newSessionId);
            
        } catch (error) {
            this.errorHandler.logError(error, 'Clear Messages');
            this.errorHandler.showUserFriendlyError('채팅 초기화 중 오류가 발생했습니다.');
        }
    }
}

// 메인 챗봇 관리자 클래스 (향상됨)
class EnhancedChatBotManager {
    constructor() {
        this.chatState = null;
        this.errorHandler = null;
        this.uiManager = null;
        this.messageHandler = null;
        this.configManager = null;
        this.securityManager = null;
        this.conversationManager = null;
        this.openAIService = null;
        this.imageManager = null;
        this.isInitialized = false;
    }

    async init() {
        try {
            // 의존성 순서대로 초기화
            this.configManager = new ConfigManager();
            this.errorHandler = new EnhancedErrorHandler();
            this.chatState = new ChatState();
            this.uiManager = new UIManager();
            this.imageManager = imageManager; // 전역 이미지 매니저 사용
            
            // 보안 관리자 초기화
            const securityConfig = this.configManager.getSecurityConfig();
            this.securityManager = new SecurityManager(securityConfig);
            
            // 보안 검증
            if (!this.securityManager.enforceHTTPS()) {
                return; // HTTPS로 리다이렉트됨
            }
            
            // 대화 관리자 초기화
            this.conversationManager = new ConversationManager(20, securityConfig.sessionTimeout);
            
            // OpenAI 서비스 초기화
            const openAIConfig = this.configManager.getOpenAIConfig();
            this.openAIService = new OpenAIService(openAIConfig);
            await this.openAIService.initialize();
            
            // 메시지 핸들러 초기화
            this.messageHandler = new EnhancedMessageHandler(
                this.chatState,
                this.uiManager,
                this.errorHandler,
                this.openAIService,
                this.securityManager,
                this.conversationManager
            );
            
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            // 초기 화면 설정
            this.showScreen('home');
            
            // 초기 세션 생성
            const initialSessionId = this.conversationManager.createSession();
            this.chatState.setCurrentSessionId(initialSessionId);
            
            // 이미지 리소스 검증
            await this.validateImageResources();
            
            this.isInitialized = true;
            console.log('Enhanced ChatBotManager initialized successfully');
            
            // API 키 설정 안내 (개발 환경)
            if (!this.configManager.hasValidApiKey()) {
                console.warn('OpenAI API key not configured. Using fallback responses.');
                console.log('To use OpenAI API, call: window.chatBotManager.setApiKey("your-api-key")');
            }
            
        } catch (error) {
            console.error('Enhanced ChatBotManager initialization failed:', error);
            if (this.errorHandler) {
                this.errorHandler.logError(error, 'ChatBotManager Initialization');
                this.errorHandler.showUserFriendlyError(CONFIG.errorMessages.initialization);
            } else {
                alert(CONFIG.errorMessages.initialization);
            }
        }
    }

    async validateImageResources() {
        try {
            const imagePaths = [
                'images/logo.svg',
                'images/user-icon.svg',
                'images/bot-icon.svg',
                'images/error-icon.svg',
                'images/success-icon.svg',
                'images/warning-icon.svg',
                'images/info-icon.svg',
                'images/loading-icon.svg'
            ];

            const validationResult = await this.imageManager.validateLocalImages(imagePaths);
            
            if (!validationResult.isValid) {
                console.warn('일부 이미지 리소스를 찾을 수 없습니다:', validationResult.brokenImages);
                console.log('SVG 폴백 아이콘이 자동으로 사용됩니다.');
            } else {
                console.log('모든 이미지 리소스가 정상적으로 로드되었습니다.');
            }

            return validationResult;
        } catch (error) {
            console.error('이미지 리소스 검증 중 오류:', error);
            return { isValid: false, error: error.message };
        }
    }

    setupEventListeners() {
        try {
            const chatInput = this.uiManager.getElement('chat-input');
            if (chatInput) {
                chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.handleSendMessage();
                    }
                });
            }

            // 전역 함수들을 인스턴스 메서드에 연결
            window.showScreen = (screenId) => this.showScreen(screenId);
            window.handleSendMessage = () => this.handleSendMessage();
            window.clearChat = () => this.clearChat();
            window.closeErrorModal = () => this.closeErrorModal();
            window.retryLastAction = () => this.retryLastAction();
            
        } catch (error) {
            this.errorHandler.logError(error, 'Setup Event Listeners');
        }
    }

    showScreen(screenId) {
        try {
            this.errorHandler.setLastAction('showScreen', screenId);
            
            if (this.uiManager.showScreen(screenId)) {
                this.chatState.setCurrentScreen(screenId);
                
                if (screenId === 'chat') {
                    this.uiManager.focusChatInput();
                }
                
                return true;
            }
            return false;
            
        } catch (error) {
            this.errorHandler.logError(error, 'Show Screen');
            this.errorHandler.showUserFriendlyError('화면 전환 중 오류가 발생했습니다.');
            return false;
        }
    }

    handleSendMessage() {
        try {
            const chatInput = this.uiManager.getElement('chat-input');
            const message = chatInput?.value?.trim();
            
            if (message) {
                this.messageHandler.sendMessage(message);
            }
        } catch (error) {
            this.errorHandler.logError(error, 'Handle Send Message');
            this.errorHandler.showUserFriendlyError(CONFIG.errorMessages.general);
        }
    }

    clearChat() {
        try {
            this.messageHandler.clearMessages();
        } catch (error) {
            this.errorHandler.logError(error, 'Clear Chat');
            this.errorHandler.showUserFriendlyError('채팅 초기화 중 오류가 발생했습니다.');
        }
    }

    closeErrorModal() {
        try {
            const errorModal = this.uiManager.getElement('error-modal');
            if (errorModal) {
                errorModal.classList.remove('modal-open');
            }
        } catch (error) {
            console.error('Error closing modal:', error);
        }
    }

    retryLastAction() {
        try {
            this.closeErrorModal();
            this.errorHandler.retryLastAction();
        } catch (error) {
            console.error('Error retrying action:', error);
        }
    }

    // API 키 설정 (개발용)
    setApiKey(apiKey) {
        try {
            this.configManager.setApiKey(apiKey);
            this.openAIService.config.apiKey = apiKey;
            this.openAIService.initialize();
            console.log('API key updated successfully');
        } catch (error) {
            console.error('Failed to set API key:', error);
        }
    }

    // 서비스 상태 확인
    getServiceStatus() {
        return {
            initialized: this.isInitialized,
            openAI: this.openAIService?.getServiceStatus(),
            security: {
                rateLimitActive: true,
                httpsEnforced: location.protocol === 'https:',
                domainValidated: this.securityManager?.validateDomain()
            },
            conversation: this.conversationManager?.getAllSessionsStats(),
            images: this.imageManager?.getStats()
        };
    }

    destroy() {
        try {
            const chatInput = this.uiManager.getElement('chat-input');
            if (chatInput) {
                chatInput.removeEventListener('keypress', this.handleSendMessage);
            }
            
            delete window.showScreen;
            delete window.handleSendMessage;
            delete window.clearChat;
            delete window.closeErrorModal;
            delete window.retryLastAction;
            
            this.isInitialized = false;
            console.log('Enhanced ChatBotManager destroyed');
            
        } catch (error) {
            console.error('Error destroying ChatBotManager:', error);
        }
    }
}

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', async function() {
    try {
        window.chatBotManager = new EnhancedChatBotManager();
        await window.chatBotManager.init();
        
        console.log('Enhanced AI-Linker application initialized successfully');
        
    } catch (error) {
        console.error('Application initialization failed:', error);
        alert('애플리케이션 초기화 중 오류가 발생했습니다. 페이지를 새로고침해주세요.');
    }
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', function() {
    if (window.chatBotManager) {
        window.chatBotManager.destroy();
    }
});

// ES6 모듈 내보내기
export { 
    EnhancedChatBotManager, 
    ChatState, 
    EnhancedMessageHandler, 
    EnhancedErrorHandler, 
    UIManager 
};