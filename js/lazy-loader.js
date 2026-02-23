'use strict';

/**
 * VanduoLazyLoader
 * Manages intersection observer based infinite scrolling.
 */
class VanduoLazyLoader {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container - The container element to append sentinel to.
     * @param {Function} options.onLoadNext - Callback fired when sentinel enters viewport.
     * @param {string} [options.rootMargin='400px'] - Intersection observer root margin.
     * @param {string} [options.sentinelId='infinite-scroll-sentinel'] - ID for the sentinel element.
     */
    constructor(options = {}) {
        if (!options.container) throw new Error('VanduoLazyLoader: container is required.');
        if (typeof options.onLoadNext !== 'function') throw new Error('VanduoLazyLoader: onLoadNext must be a function.');

        this.container = options.container;
        this.onLoadNext = options.onLoadNext;
        this.rootMargin = options.rootMargin || '400px';
        this.sentinelId = options.sentinelId || 'infinite-scroll-sentinel';
        this.observer = null;
    }

    /**
     * Initializes the IntersectionObserver and sentinel element.
     */
    init() {
        this.disconnect();

        let sentinel = document.getElementById(this.sentinelId);
        if (!sentinel) {
            sentinel = document.createElement('div');
            sentinel.id = this.sentinelId;
            sentinel.style.height = '1px';
            sentinel.style.width = '100%';
            this.container.appendChild(sentinel);
        } else {
            // Move to the very bottom of the container
            this.container.appendChild(sentinel);
        }

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    this.onLoadNext();
                }
            });
        }, { rootMargin: this.rootMargin, threshold: 0 });

        this.observer.observe(sentinel);
    }

    /**
     * Disconnects the observer.
     */
    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

// Attach to window for global usage
if (typeof window !== 'undefined') {
    window.VanduoLazyLoader = VanduoLazyLoader;
}
