import { getTotalSectionCount, loadRegistry } from './modules/registry.js';
import {
    handleDocBoundaryScroll,
    primeDocNavigationForHash,
    requestActiveDocSectionUpdate,
    setDocNavigationRouter
} from './modules/doc-navigation.js';
import {
    initDocModeToggle,
    initMobileToc,
    initSidebarFilterEvents,
    initSidebarNavEvents
} from './modules/sidebar.js';
import { handleRoute, navigate } from './modules/router.js';
import { initGlobalSearch } from './modules/search.js';
import {
    bootstrapCustomizerDemo,
    initDraggableDropDemo,
    initInteractiveDemos
} from './modules/demos.js';
import { wireRouteLinks } from './modules/utils.js';

function initFramework() {
    if (typeof window.Vanduo === 'undefined') {
        console.error('Vanduo failed to load from CDN. Check network/CDN availability.');
        return;
    }

    function getResolvedThemeMode(mode) {
        if (mode !== 'system') {
            return mode;
        }
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    }

    function applyResolvedDocsTheme(mode) {
        document.documentElement.setAttribute('data-theme', getResolvedThemeMode(mode));
    }

    if (window.Vanduo.components && window.Vanduo.components.themeSwitcher) {
        window.Vanduo.components.themeSwitcher.applyTheme = function () {
            applyResolvedDocsTheme(this.state.preference);
        };
    }

    if (window.ThemeCustomizer) {
        var docsFontOptions = {
            'jetbrains-mono': { name: 'JetBrains Mono', family: "'JetBrains Mono', monospace" },
            'system': { name: 'System Default', family: null },
            'ubuntu': { name: 'Ubuntu', family: "'Ubuntu', sans-serif" },
            'lato': { name: 'Lato', family: "'Lato', sans-serif" },
            'open-sans': { name: 'Open Sans', family: "'Open Sans', sans-serif" }
        };
        window.ThemeCustomizer.applyTheme = function (mode) {
            var nextMode = this.THEME_MODES.includes(mode) ? mode : this.DEFAULTS.THEME;

            this._isApplying = true;

            if (this.isUsingDefaultPrimary()) {
                var expected = this.getDefaultPrimary(nextMode);
                if (this.state.primary !== expected) {
                    this.applyPrimary(expected);
                }
            }

            this.state.theme = nextMode;
            applyResolvedDocsTheme(nextMode);
            this.savePreference(this.STORAGE_KEYS.THEME, nextMode);

            if (window.Vanduo && window.Vanduo.components.themeSwitcher) {
                var themeSwitcher = window.Vanduo.components.themeSwitcher;
                if (themeSwitcher.state && themeSwitcher.state.preference !== nextMode) {
                    themeSwitcher.state.preference = nextMode;
                    if (typeof themeSwitcher.setStorageValue === 'function') {
                        themeSwitcher.setStorageValue(themeSwitcher.STORAGE_KEY, nextMode);
                    }
                    if (typeof themeSwitcher.updateUI === 'function') {
                        themeSwitcher.updateUI();
                    }
                }
            }

            this._isApplying = false;
            this.dispatchEvent('mode-change', { mode: nextMode });
        };

        window.ThemeCustomizer.FONT_OPTIONS = docsFontOptions;
        Object.assign(window.ThemeCustomizer.DEFAULTS, {
            FONT: 'ubuntu',
            PRIMARY_LIGHT: 'black',
            PRIMARY_DARK: 'blue',
            NEUTRAL: 'stone',
            RADIUS: '0.5'
        });
    }
    window.Vanduo.init();
}

function initScrollRestoration() {
    if (window.history && 'scrollRestoration' in window.history) {
        var initialHash = (window.location.hash || '').replace(/^#\/?/, '');
        if (initialHash.startsWith('docs/') && initialHash !== 'docs/components' && initialHash !== 'docs/guides') {
            window.history.scrollRestoration = 'manual';
        }
    }
}

function initNavbarLinks() {
    document.querySelectorAll('.vd-navbar-nav .vd-nav-link[data-route]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            var route = link.getAttribute('data-route');
            navigate(route);
        });
    });

    var brandLink = document.querySelector('.vd-navbar-brand a[data-route]');
    if (brandLink) {
        brandLink.addEventListener('click', function (e) {
            e.preventDefault();
            navigate('home');
        });
    }
}

function initDocsHeightTracking() {
    var wrapper = document.querySelector('.doc-water-toggle-wrapper');
    var sidebar = document.querySelector('.doc-sidebar');
    if (!wrapper) {
        document.documentElement.style.setProperty('--doc-tabs-height', '0px');
        document.documentElement.style.setProperty('--doc-mobile-controls-height', '0px');
        return;
    }

    function getVisibleOuterHeight(el) {
        if (!el) return 0;
        var style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return 0;
        var marginTop = parseFloat(style.marginTop) || 0;
        var marginBottom = parseFloat(style.marginBottom) || 0;
        return el.offsetHeight + marginTop + marginBottom;
    }

    var updateHeightVar = function () {
        var filter = document.querySelector('.doc-sidebar-filter');
        var tocToggle = document.querySelector('.doc-sidebar-toggle');
        var gapPx = 0;

        if (filter) {
            gapPx = parseFloat(getComputedStyle(filter).marginTop) || 0;
        }

        document.documentElement.style.setProperty('--doc-tabs-height',
            (wrapper.offsetHeight + gapPx) + 'px');

        if (!window.matchMedia('(max-width: 991px)').matches) {
            document.documentElement.style.setProperty('--doc-mobile-controls-height', '0px');
            return;
        }

        var controlsHeight = getVisibleOuterHeight(wrapper)
            + getVisibleOuterHeight(filter)
            + getVisibleOuterHeight(tocToggle);

        document.documentElement.style.setProperty('--doc-mobile-controls-height',
            controlsHeight + 'px');
    };

    var ro = new ResizeObserver(function () {
        updateHeightVar();
    });
    ro.observe(wrapper);
    if (sidebar) ro.observe(sidebar);
    var filterEl = document.querySelector('.doc-sidebar-filter');
    var tocToggleEl = document.querySelector('.doc-sidebar-toggle');
    if (filterEl) ro.observe(filterEl);
    if (tocToggleEl) ro.observe(tocToggleEl);

    window.addEventListener('resize', updateHeightVar, { passive: true });
    window.addEventListener('hashchange', updateHeightVar);
    updateHeightVar();
}

function initDarkModeToggleIconSync() {
    var toggle = document.getElementById('dark-mode-toggle');
    if (!toggle) return;
    var icon = toggle.querySelector('i');
    if (!icon) return;

    function updateIcon() {
        var pref = 'system';
        try {
            pref = localStorage.getItem('vanduo-theme-preference') || 'system';
        } catch (e) { /* noop */ }

        if (pref === 'system') {
            icon.className = 'ph ph-desktop';
            toggle.setAttribute('aria-label', 'Theme: System (Click to switch to Light)');
        } else if (pref === 'light') {
            icon.className = 'ph ph-sun';
            toggle.setAttribute('aria-label', 'Theme: Light (Click to switch to Dark)');
        } else {
            icon.className = 'ph ph-moon';
            toggle.setAttribute('aria-label', 'Theme: Dark (Click to switch to System)');
        }
    }

    updateIcon();

    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            if (m.attributeName === 'data-theme') updateIcon();
        });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

function initRouteListeners() {
    wireRouteLinks(document.querySelector('.vd-footer'), navigate);

    window.addEventListener('hashchange', function () {
        primeDocNavigationForHash(window.location.hash);
        handleRoute();
    });
    window.addEventListener('scroll', handleDocBoundaryScroll, { passive: true });
    window.addEventListener('resize', requestActiveDocSectionUpdate);
}

function initCopyClassNameInteraction() {
    document.body.addEventListener('click', function (e) {
        var target = e.target;
        if (!(target instanceof Element)) return;
        if ((target.tagName === 'CODE' && target.closest('.vd-table'))
            || (target.classList.contains('code-selector') && target.closest('.vd-code-snippet'))) {
            var textToCopy = target.textContent || target.innerText;
            navigator.clipboard.writeText(textToCopy.trim()).then(function () {
                target.classList.add('copied-inline');
                setTimeout(function () {
                    target.classList.remove('copied-inline');
                }, 2000);
            }).catch(function (err) {
                console.error('Failed to copy class name: ', err);
            });
        }
    });
}

function updateDocsCountBadges() {
    var totalSections = getTotalSectionCount();
    var countEl = document.getElementById('docs-component-count-num');
    if (countEl) countEl.textContent = totalSections + '+';
    var cardCountEl = document.getElementById('docs-landing-components-count');
    if (cardCountEl) cardCountEl.textContent = totalSections + '+';
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    var isLocalPreview = window.location.protocol === 'file:'
        || window.location.hostname === 'localhost'
        || window.location.hostname === '127.0.0.1';
    if (!isLocalPreview) {
        navigator.serviceWorker.register('./sw.js').catch(function (err) {
            console.warn('Service worker registration failed', err);
        });
    }
}

function initStaticEventHandlers() {
    setDocNavigationRouter(navigate);
    initNavbarLinks();
    initDocModeToggle(navigate);
    initDocsHeightTracking();
    initMobileToc();
    initSidebarNavEvents(navigate);
    initSidebarFilterEvents();
    initInteractiveDemos();
    initDraggableDropDemo();
    initRouteListeners();
    initDarkModeToggleIconSync();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapCustomizerDemo);
    } else {
        bootstrapCustomizerDemo();
    }
}

(async function initApp() {
    initFramework();
    initScrollRestoration();
    initStaticEventHandlers();

    primeDocNavigationForHash(window.location.hash);
    await loadRegistry();
    initGlobalSearch();
    updateDocsCountBadges();
    initCopyClassNameInteraction();
    await handleRoute();
    registerServiceWorker();
})();
