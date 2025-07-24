/**
 * 이미지 리소스 관리 모듈
 * 외부 이미지 URL 제거 및 로컬 리소스 관리
 */

class ImageManager {
    constructor() {
        this.fallbackIcons = new Map();
        this.loadedImages = new Set();
        this.failedImages = new Set();
        this.initializeFallbackIcons();
    }

    /**
     * 폴백 아이콘 초기화
     */
    initializeFallbackIcons() {
        this.fallbackIcons.set('user', this.generateUserIcon());
        this.fallbackIcons.set('bot', this.generateBotIcon());
        this.fallbackIcons.set('error', this.generateErrorIcon());
        this.fallbackIcons.set('success', this.generateSuccessIcon());
        this.fallbackIcons.set('warning', this.generateWarningIcon());
        this.fallbackIcons.set('info', this.generateInfoIcon());
        this.fallbackIcons.set('loading', this.generateLoadingIcon());
        this.fallbackIcons.set('default', this.generateDefaultIcon());
    }

    /**
     * 이미지 로드 상태 확인
     * @param {string} imagePath - 이미지 경로
     * @returns {Promise<boolean>} 로드 성공 여부
     */
    async checkImageLoad(imagePath) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.loadedImages.add(imagePath);
                resolve(true);
            };
            img.onerror = () => {
                this.failedImages.add(imagePath);
                resolve(false);
            };
            img.src = imagePath;
        });
    }

    /**
     * 폴백 이미지 설정
     * @param {HTMLImageElement} element - 이미지 엘리먼트
     * @param {string} fallbackType - 폴백 타입
     */
    setFallbackImage(element, fallbackType = 'default') {
        const fallbackSvg = this.fallbackIcons.get(fallbackType) || this.fallbackIcons.get('default');
        const svgBlob = new Blob([fallbackSvg], { type: 'image/svg+xml' });
        const svgUrl = URL.createObjectURL(svgBlob);
        
        element.src = svgUrl;
        element.classList.add('fallback-image');
        
        // 메모리 정리를 위해 로드 후 URL 해제
        element.onload = () => {
            setTimeout(() => URL.revokeObjectURL(svgUrl), 1000);
        };
    }

    /**
     * 이미지 로드 오류 핸들링
     * @param {HTMLImageElement} element - 이미지 엘리먼트
     * @param {string} fallbackType - 폴백 타입
     */
    handleImageError(element, fallbackType = 'default') {
        console.warn(`이미지 로드 실패: ${element.src}`);
        this.setFallbackImage(element, fallbackType);
        
        // 오류 이벤트 발생
        const errorEvent = new CustomEvent('imageLoadError', {
            detail: {
                originalSrc: element.src,
                fallbackType: fallbackType,
                element: element
            }
        });
        document.dispatchEvent(errorEvent);
    }

    /**
     * 로컬 이미지 리소스 검증
     * @param {string[]} imagePaths - 검증할 이미지 경로 배열
     * @returns {Promise<Object>} 검증 결과
     */
    async validateLocalImages(imagePaths = []) {
        const results = {
            isValid: true,
            missingImages: [],
            brokenImages: [],
            totalChecked: imagePaths.length,
            validImages: []
        };

        for (const path of imagePaths) {
            const isLoaded = await this.checkImageLoad(path);
            if (isLoaded) {
                results.validImages.push(path);
            } else {
                results.brokenImages.push(path);
                results.isValid = false;
            }
        }

        return results;
    }

    /**
     * 이미지 프리로드
     * @param {string[]} imagePaths - 프리로드할 이미지 경로 배열
     * @returns {Promise<Object[]>} 프리로드 결과
     */
    async preloadImages(imagePaths) {
        const results = [];
        
        for (const path of imagePaths) {
            try {
                const loaded = await this.checkImageLoad(path);
                results.push({
                    path: path,
                    loaded: loaded,
                    error: loaded ? null : '이미지 로드 실패'
                });
            } catch (error) {
                results.push({
                    path: path,
                    loaded: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * 이미지 엘리먼트에 오류 핸들러 추가
     * @param {HTMLImageElement} img - 이미지 엘리먼트
     * @param {string} fallbackType - 폴백 타입
     */
    addErrorHandler(img, fallbackType = 'default') {
        img.addEventListener('error', () => {
            this.handleImageError(img, fallbackType);
        });
    }

    /**
     * 모든 이미지 엘리먼트에 오류 핸들러 추가
     */
    initializeImageErrorHandlers() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            // 이미 핸들러가 추가된 경우 스킵
            if (img.hasAttribute('data-error-handler')) return;
            
            const fallbackType = img.getAttribute('data-fallback-type') || 'default';
            this.addErrorHandler(img, fallbackType);
            img.setAttribute('data-error-handler', 'true');
        });
    }

    // SVG 아이콘 생성 메서드들
    generateUserIcon(size = 24) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>`;
    }

    generateBotIcon(size = 24) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>`;
    }

    generateErrorIcon(size = 24) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>`;
    }

    generateSuccessIcon(size = 24) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>`;
    }

    generateWarningIcon(size = 24) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>`;
    }

    generateInfoIcon(size = 24) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>`;
    }

    generateLoadingIcon(size = 24) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z">
                <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
            </path>
        </svg>`;
    }

    generateDefaultIcon(size = 24) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>`;
    }

    /**
     * 통계 정보 반환
     * @returns {Object} 이미지 로드 통계
     */
    getStats() {
        return {
            loadedCount: this.loadedImages.size,
            failedCount: this.failedImages.size,
            loadedImages: Array.from(this.loadedImages),
            failedImages: Array.from(this.failedImages)
        };
    }

    /**
     * 캐시 정리
     */
    clearCache() {
        this.loadedImages.clear();
        this.failedImages.clear();
    }
}

// 전역 이미지 매니저 인스턴스
const imageManager = new ImageManager();

// DOM 로드 완료 시 이미지 오류 핸들러 초기화
document.addEventListener('DOMContentLoaded', () => {
    imageManager.initializeImageErrorHandlers();
});

// 동적으로 추가된 이미지에 대한 감시
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const images = node.tagName === 'IMG' ? [node] : node.querySelectorAll('img');
                images.forEach(img => {
                    if (!img.hasAttribute('data-error-handler')) {
                        const fallbackType = img.getAttribute('data-fallback-type') || 'default';
                        imageManager.addErrorHandler(img, fallbackType);
                        img.setAttribute('data-error-handler', 'true');
                    }
                });
            }
        });
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

export { ImageManager, imageManager };