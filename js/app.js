if (typeof window.Vanduo === 'undefined') {
    console.error('Vanduo failed to load from CDN. Check network/CDN availability.');
} else {
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

    // Extend theme customizer with site-specific fonts and override defaults
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

/* ── Hide disabled code-snippet tabs ─────────────── */
function hideDisabledCodeTabs(container) {
    if (!container) return;
    container.querySelectorAll('.vd-code-snippet-tab[disabled]').forEach(function (tab) {
        tab.style.display = 'none';
    });
}

/* ── Safe HTML injection for docs content ─────────── */
function safeInjectHtml(container, html) {
    if (!container) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || '').trim(), 'text/html');

    const DANGEROUS_TAGS = ['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'BASE', 'LINK', 'META'];
    for (const tag of DANGEROUS_TAGS) {
        const els = doc.querySelectorAll(tag);
        for (let i = els.length - 1; i >= 0; i--) {
            els[i].parentNode.removeChild(els[i]);
        }
    }

    function sanitizeNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const attrs = node.attributes;
            for (let i = attrs.length - 1; i >= 0; i--) {
                const attrName = attrs[i].name.toLowerCase();
                const attrValue = (attrs[i].value || '').toLowerCase();
                const trimmedValue = attrValue.trim();
                if (
                    attrName.startsWith('on') ||
                    attrName === 'srcdoc' ||
                    trimmedValue.startsWith('javascript:') ||
                    trimmedValue.startsWith('data:') ||
                    trimmedValue.startsWith('vbscript:')
                ) {
                    node.removeAttribute(attrs[i].name);
                }
            }
            const children = node.childNodes;
            for (let i = 0; i < children.length; i++) {
                sanitizeNode(children[i]);
            }
        }
    }
    sanitizeNode(doc.body);

    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    Array.from(doc.body.childNodes).forEach(function (node) {
        container.appendChild(document.adoptNode(node));
    });
}

function initVanduoScope(root) {
    if (window.Vanduo && typeof window.Vanduo.init === 'function') {
        window.Vanduo.init(root || document);
    }
}

function destroyVanduoScope(root) {
    if (window.Vanduo && typeof window.Vanduo.destroy === 'function' && root) {
        window.Vanduo.destroy(root);
    }
}

function setMorphBadgeContent(target, icon, label) {
    if (!target) return;
    const safeIcon = String(icon || '').replace(/[^a-z0-9-\s]/gi, '').trim();
    const text = label == null ? '' : String(label);

    while (target.firstChild) {
        target.removeChild(target.firstChild);
    }

    if (safeIcon) {
        const iEl = document.createElement('i');
        iEl.className = 'ph ' + safeIcon;
        iEl.style.marginRight = '0.35rem';
        target.appendChild(iEl);
    }

    target.appendChild(document.createTextNode(text));
}

/* ── Constants ────────────────────────────────── */
const SECTIONS_BASE = './sections/';
const DOCS_CONTENT_VERSION = '1.4.1-docs-1';
let registry = { pages: [], tabs: {} };
const loadedSections = new Set();
const loadingSections = new Set();
let scrollSpyObserver = null;
let docTopBoundaryObserver = null;
let docBottomBoundaryObserver = null;
let docTopBoundaryEl = null;
let docBottomBoundaryEl = null;
let currentView = null;
let currentTab = null;
let scrollSpyTicking = false;
let activeDocSectionId = null;
let pendingDocNavigationId = null;
let pendingDocNavigationReleaseTimer = null;
let docScrollLoaderEl = null;
let docScrollLoaderTargetId = null;
let docScrollLoaderFallbackTimer = null;
let requestedDocScrollLoaderSectionId = null;
let currentNavigationController = null;
const sectionPrefetching = new Set();
let docTopBoundaryArmed = false;
let docBottomBoundaryArmed = false;
let docBoundaryPrevLoading = false;
let docBoundaryNextLoading = false;
let docLastKnownScrollY = window.scrollY || window.pageYOffset || 0;
let docContentEpoch = 0;
const DOC_TOP_BOUNDARY_SENTINEL_ID = 'docs-scroll-top-sentinel';
const DOC_BOTTOM_BOUNDARY_SENTINEL_ID = 'infinite-scroll-sentinel';
const DOC_BOUNDARY_ROOT_MARGIN = '400px 0px 400px 0px';
const DOC_NEIGHBOR_PREFETCH_RADIUS = 1;
const DOC_RUNWAY_BOTTOM_THRESHOLD = 48;

if (window.history && 'scrollRestoration' in window.history) {
    var initialHash = (window.location.hash || '').replace(/^#\/?/, '');
    if (initialHash.startsWith('docs/') && initialHash !== 'docs/components' && initialHash !== 'docs/guides') {
        window.history.scrollRestoration = 'manual';
    }
}

function withDocsContentVersion(url) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(DOCS_CONTENT_VERSION);
}

function releasePendingDocNavigation(delayMs = 0) {
    if (pendingDocNavigationReleaseTimer) {
        clearTimeout(pendingDocNavigationReleaseTimer);
        pendingDocNavigationReleaseTimer = null;
    }
    if (delayMs > 0) {
        pendingDocNavigationReleaseTimer = setTimeout(function () {
            pendingDocNavigationId = null;
            pendingDocNavigationReleaseTimer = null;
        }, delayMs);
        return;
    }
    pendingDocNavigationId = null;
}

function clearDocScrollLoaderFallbackTimer() {
    if (docScrollLoaderFallbackTimer) {
        clearTimeout(docScrollLoaderFallbackTimer);
        docScrollLoaderFallbackTimer = null;
    }
}

function clearNavigatingNavLinks() {
    document.querySelectorAll('.doc-nav-link.is-navigating').forEach(function (link) {
        link.classList.remove('is-navigating');
    });
}

function extractDocsSectionId(value) {
    var normalized = String(value || '').replace(/^#\/?/, '');
    if (!normalized.startsWith('docs/')) return null;
    if (normalized === 'docs' || normalized === 'docs/components' || normalized === 'docs/guides') return null;

    var fullPath = normalized.slice(5);
    var routePath = fullPath.split('#')[0];
    var segments = routePath.split('/').filter(Boolean);

    if (segments.length >= 2 && (segments[0] === 'components' || segments[0] === 'guides')) {
        return segments[1] || null;
    }

    return routePath || null;
}

function requestDocScrollLoaderForRoute(route) {
    if (typeof route !== 'string' || !route.startsWith('docs/')) {
        requestedDocScrollLoaderSectionId = null;
        return;
    }
    var parsed = parseHash('#' + route);
    requestedDocScrollLoaderSectionId = parsed && parsed.section ? parsed.section : extractDocsSectionId(route);
}

function shouldRequestDocScrollLoaderForRoute(route, options) {
    if (options && options.showScrollLoader === true) return true;
    if (options && options.showScrollLoader === false) return false;

    var parsed = parseHash('#' + route);
    if (parsed.view !== 'docs' || !parsed.section) return false;

    // Sidebar-style in-page jumps within the active docs tab.
    if (currentView === 'docs' && currentTab === parsed.tab) return false;

    return true;
}

function primeDocNavigationForHash(hash, options) {
    if (window.history && 'scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
    }

    var parsed = parseHash(hash);
    var sectionId = parsed && parsed.view === 'docs' && parsed.section
        ? parsed.section
        : extractDocsSectionId(hash);
    if (!sectionId) {
        requestedDocScrollLoaderSectionId = null;
        return;
    }

    var route = 'docs/' + sectionId;
    if (shouldRequestDocScrollLoaderForRoute(route, options || {})) {
        requestDocScrollLoaderForRoute(route);
    } else {
        requestedDocScrollLoaderSectionId = null;
    }
    pendingDocNavigationId = sectionId;
}

/* ── Loading placeholders ─────────────────────── */
/*
 * NOTE: This SPA uses its OWN lazy loading, separate from the framework's
 * VanduoLazyLoad component (js/components/lazy-load.js). Both share the same
 * placeholder DNA (skeleton card + quad-spinner), but serve different purposes:
 *
 *   • Docs loadSection() / loadPage()  – application-level, tightly coupled
 *     to the SPA router, ordered DOM insertion, scroll-spy, sidebar sync,
 *     section caching, and history state. Route-triggered.
 *
 *   • Framework VanduoLazyLoad         – generic, reusable IntersectionObserver
 *     wrapper for end-users. Viewport-triggered. No routing awareness.
 *
 * Merging them would require the framework component to know about SPA routing
 * internals, which violates its generic design. The duplication is intentional.
 */
var VANDUO_BRAND_LOGO_SRC = 'vanduo-new-logo.svg';

function getVanduoDynamicLoaderMarkHtml() {
    return '<div class="vd-dynamic-loader-mark" aria-hidden="true">'
        + '<img class="vd-dynamic-loader-logo" src="' + VANDUO_BRAND_LOGO_SRC + '" alt="" width="495" height="495" decoding="async">'
        + '</div>';
}

function getLoadingPlaceholderHtml() {
    return '<div style="padding: 4rem 0; scroll-margin-top: 80px; border-bottom: 1px solid var(--vd-border-color);">'
        + '<div class="vd-skeleton-card vd-glass vd-glass-contrast" style="position: relative; min-height: 300px; padding: 2rem; overflow: hidden;">'
        + '<div class="vd-skeleton vd-skeleton-heading-lg" style="margin-bottom: 1.5rem;"></div>'
        + '<div class="vd-skeleton vd-skeleton-paragraph">'
        + '<div class="vd-skeleton vd-skeleton-text"></div>'
        + '<div class="vd-skeleton vd-skeleton-text"></div>'
        + '<div class="vd-skeleton vd-skeleton-text"></div>'
        + '<div class="vd-skeleton vd-skeleton-text"></div></div>'
        + '<div style="margin-top: 1.5rem;"></div>'
        + '<div class="vd-skeleton vd-skeleton-rect-sm" style="margin-bottom: 1.5rem;"></div>'
        + '<div class="vd-skeleton vd-skeleton-paragraph">'
        + '<div class="vd-skeleton vd-skeleton-text"></div>'
        + '<div class="vd-skeleton vd-skeleton-text"></div></div>'
        + '<div class="vd-dynamic-loader" style="position: absolute; inset: 0;">'
        + getVanduoDynamicLoaderMarkHtml()
        + '<span class="vd-dynamic-loader-text">Loading section...</span></div></div></div>';
}

function getPagePlaceholderHtml() {
    return '<div style="min-height: 60vh; display: flex; align-items: center; justify-content: center;">'
        + '<div class="vd-dynamic-loader">'
        + getVanduoDynamicLoaderMarkHtml()
        + '<span class="vd-dynamic-loader-text">Loading...</span></div></div>';
}

function getDocScrollLoaderHtml() {
    return '<div class="vd-skeleton-card vd-glass vd-glass-contrast" style="position: relative; min-height: 220px; padding: 1.5rem; overflow: hidden;">'
        + '<div class="vd-skeleton vd-skeleton-heading-lg" style="margin-bottom: 1.25rem;"></div>'
        + '<div class="vd-skeleton vd-skeleton-paragraph">'
        + '<div class="vd-skeleton vd-skeleton-text"></div>'
        + '<div class="vd-skeleton vd-skeleton-text"></div>'
        + '<div class="vd-skeleton vd-skeleton-text"></div></div>'
        + '<div style="margin-top: 1.25rem;"></div>'
        + '<div class="vd-skeleton vd-skeleton-rect-sm" style="margin-bottom: 1.25rem;"></div>'
        + '<div class="vd-skeleton vd-skeleton-paragraph">'
        + '<div class="vd-skeleton vd-skeleton-text"></div>'
        + '<div class="vd-skeleton vd-skeleton-text"></div></div>'
        + '<div class="vd-dynamic-loader" style="position: absolute; inset: 0;">'
        + getVanduoDynamicLoaderMarkHtml()
        + '<span class="vd-dynamic-loader-text">Finding section...</span></div></div>';
}

function hideDocScrollLoader() {
    clearDocScrollLoaderFallbackTimer();
    clearNavigatingNavLinks();
    if (docScrollLoaderEl) {
        docScrollLoaderEl.remove();
        docScrollLoaderEl = null;
    }
    docScrollLoaderTargetId = null;
}

function showDocScrollLoader(sectionId) {
    if (!sectionId) return;
    var docsView = document.getElementById('docs-view');
    if (!docsView || !docsView.classList.contains('is-active')) return;

    hideDocScrollLoader();

    docScrollLoaderEl = document.createElement('div');
    docScrollLoaderEl.className = 'doc-scroll-loader-card';
    docScrollLoaderEl.setAttribute('role', 'status');
    docScrollLoaderEl.setAttribute('aria-live', 'polite');
    docScrollLoaderEl.innerHTML = getDocScrollLoaderHtml();
    document.body.appendChild(docScrollLoaderEl);
    window.requestAnimationFrame(function () {
        if (docScrollLoaderEl) docScrollLoaderEl.classList.add('is-visible');
    });

    docScrollLoaderTargetId = sectionId;
    clearDocScrollLoaderFallbackTimer();
    docScrollLoaderFallbackTimer = setTimeout(hideDocScrollLoader, 4500);
}

function settleDocScrollLoader(sectionId) {
    // Release the scroll-spy hijack guard only after this function is done
    // verifying the landing — avoids URL/title being overwritten to the
    // section currently in viewport mid-scroll on long deep links.
    function releaseGuardIfMatching() {
        if (pendingDocNavigationId === sectionId) {
            releasePendingDocNavigation(0);
        }
    }

    if (!docScrollLoaderEl || !sectionId || docScrollLoaderTargetId !== sectionId) {
        // Loader was not mounted for this nav (e.g. back/forward hashchange).
        // Still run one rAF-deferred release so any in-flight smooth scroll
        // or layout reflow settles before scroll-spy takes over the URL.
        if (pendingDocNavigationId === sectionId) {
            window.requestAnimationFrame(function () {
                window.requestAnimationFrame(releaseGuardIfMatching);
            });
        }
        return;
    }

    var deadline = Date.now() + 3200;
    var stableFrames = 0;
    var stableSince = 0;
    function checkScrollCompletion() {
        if (!docScrollLoaderEl || docScrollLoaderTargetId !== sectionId) {
            releaseGuardIfMatching();
            return;
        }
        var target = document.getElementById(sectionId);
        if (!target) {
            if (Date.now() >= deadline) {
                hideDocScrollLoader();
                releaseGuardIfMatching();
            } else {
                window.requestAnimationFrame(checkScrollCompletion);
            }
            return;
        }

        var targetTop = target.getBoundingClientRect().top;
        var driftedDown = targetTop > (SCROLL_SPY_OFFSET + ACTIVE_DOC_SECTION_TOLERANCE);
        var driftedUp = targetTop < -4;
        if (driftedDown || driftedUp) {
            // 'instant' to bypass the global `html { scroll-behavior: smooth }`
            // so drift correction actually snaps rather than animating.
            target.scrollIntoView({ behavior: 'instant', block: 'start' });
            targetTop = target.getBoundingClientRect().top;
            stableFrames = 0;
            stableSince = 0;
        }
        var reachedTarget = targetTop <= (SCROLL_SPY_OFFSET + ACTIVE_DOC_SECTION_TOLERANCE) && targetTop >= -4;
        if (reachedTarget) {
            // Require a short stable window so late layout shifts
            // (icon font swap, lazy demo init, preloaded demo expansion) get
            // another correction pass before scroll-spy can rewrite the URL.
            if (!stableSince) stableSince = Date.now();
            stableFrames += 1;
            if (stableFrames >= 2 && Date.now() - stableSince >= 900) {
                hideDocScrollLoader();
                releaseGuardIfMatching();
                return;
            }
        } else {
            stableFrames = 0;
            stableSince = 0;
        }
        if (Date.now() >= deadline) {
            hideDocScrollLoader();
            releaseGuardIfMatching();
            return;
        }
        window.requestAnimationFrame(checkScrollCompletion);
    }

    window.requestAnimationFrame(checkScrollCompletion);
}

/* ── Title Update Helper ──────────────────────── */
function setDocumentTitle(title) {
    var baseTitle = 'Vanduo Framework';
    if (title === 'Home') {
        document.title = baseTitle;
    } else if (title) {
        document.title = title + ' - ' + baseTitle;
    } else {
        document.title = baseTitle;
    }
}

/* ── Registry helpers ─────────────────────────── */
function findSectionMeta(sectionId) {
    for (var tabKey of Object.keys(registry.tabs)) {
        var tab = registry.tabs[tabKey];
        for (var cat of tab.categories) {
            var sec = cat.sections.find(function (s) { return s.id === sectionId; });
            if (sec) return { section: sec, category: cat.name, tab: tabKey };
        }
    }
    return null;
}

function findPageMeta(pageId) {
    return registry.pages.find(function (p) { return p.id === pageId; }) || null;
}

function getTabForSection(sectionId) {
    var meta = findSectionMeta(sectionId);
    return meta ? meta.tab : null;
}

function getOrderedIds(tabKey) {
    var tab = registry.tabs[tabKey];
    if (!tab) return [];
    return tab.categories.flatMap(function (c) { return c.sections.map(function (s) { return s.id; }); });
}

function parseSectionIdFromRoute(route) {
    if (typeof route !== 'string' || !route.startsWith('docs/')) return null;
    var parsed = parseHash('#' + route);
    return parsed && parsed.section ? parsed.section : extractDocsSectionId(route);
}

function getCachedSectionHtml(sectionId) {
    if (!window.VanduoSectionCache || !sectionId) return null;
    return window.VanduoSectionCache.get(sectionId);
}

function setCachedSectionHtml(sectionId, html) {
    if (!window.VanduoSectionCache || !sectionId || typeof html !== 'string') return;
    window.VanduoSectionCache.set(sectionId, html);
}

async function prefetchSection(sectionId, options = {}) {
    if (!sectionId || loadedSections.has(sectionId) || loadingSections.has(sectionId)) return;
    if (getCachedSectionHtml(sectionId)) return;
    if (sectionPrefetching.has(sectionId)) return;

    var meta = findSectionMeta(sectionId);
    if (!meta || !meta.section || !meta.section.file) return;

    sectionPrefetching.add(sectionId);
    try {
        var res = await fetch(withDocsContentVersion(SECTIONS_BASE + meta.section.file), { signal: options.signal, cache: 'no-store' });
        if (!res.ok) return;
        var html = await res.text();
        if (html) setCachedSectionHtml(sectionId, html);
    } catch (err) {
        if (!err || err.name !== 'AbortError') {
            console.warn('Section prefetch failed for', sectionId, err);
        }
    } finally {
        sectionPrefetching.delete(sectionId);
    }
}

/* ── Registry loading ─────────────────────────── */
async function loadRegistry() {
    var res = await fetch(withDocsContentVersion(SECTIONS_BASE + 'sections.json'), { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load sections.json');
    registry = await res.json();
}

/* ── Sidebar navigation builder ───────────────── */
function buildSidebar(tabKey) {
    var navList = document.getElementById('dynamic-nav-list');
    if (!navList) return;
    navList.innerHTML = '';

    // Reset inline filter on every tab switch
    var searchInput = document.getElementById('doc-sidebar-filter-input');
    if (searchInput) { searchInput.value = ''; }

    var tab = registry.tabs[tabKey];
    if (!tab) return;
    tab.categories.forEach(function (cat) {
        var liSec = document.createElement('li');
        liSec.className = 'doc-nav-section';
        liSec.textContent = cat.name;
        navList.appendChild(liSec);
        cat.sections.forEach(function (sec) {
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.href = '#docs/' + sec.id;
            a.className = 'doc-nav-link';
            a.setAttribute('data-section', sec.id);
            a.textContent = sec.title;
            if (sec.icon) {
                var iElement = document.createElement('i');
                iElement.className = 'ph ' + sec.icon + ' mr-2';
                a.prepend(iElement);
            }
            li.appendChild(a);
            navList.appendChild(li);
        });
    });
}

/* ── Sidebar inline filter ───────────────────── */
function filterSidebarNav(query) {
    var navList = document.getElementById('dynamic-nav-list');
    if (!navList) return;
    var q = query.trim().toLowerCase();

    // Remove any existing no-results message
    var existing = navList.querySelector('.doc-sidebar-filter-no-results');
    if (existing) existing.remove();

    if (!q) {
        navList.querySelectorAll('li').forEach(function (li) { li.style.display = ''; });
        return;
    }

    var items = Array.from(navList.children);
    var anyVisible = false;
    var i = 0;
    while (i < items.length) {
        var li = items[i];
        if (li.classList.contains('doc-nav-section')) {
            var sectionLi = li;
            var linkItems = [];
            i++;
            while (i < items.length && !items[i].classList.contains('doc-nav-section')) {
                linkItems.push(items[i]);
                i++;
            }
            var sectionHasMatch = false;
            linkItems.forEach(function (linkLi) {
                var link = linkLi.querySelector('.doc-nav-link');
                var text = link ? link.textContent.toLowerCase() : '';
                if (text.includes(q)) {
                    linkLi.style.display = '';
                    sectionHasMatch = true;
                    anyVisible = true;
                } else {
                    linkLi.style.display = 'none';
                }
            });
            sectionLi.style.display = sectionHasMatch ? '' : 'none';
        } else {
            var link = li.querySelector('.doc-nav-link');
            var text = link ? link.textContent.toLowerCase() : '';
            if (text.includes(q)) {
                li.style.display = '';
                anyVisible = true;
            } else {
                li.style.display = 'none';
            }
            i++;
        }
    }

    if (!anyVisible) {
        var hint = document.createElement('li');
        hint.className = 'doc-sidebar-filter-no-results';
        hint.textContent = 'No matches';
        navList.appendChild(hint);
    }
}

/* ── Docs mode toggle state ───────────────────── */

var _toggleMorphing = false;
var _pendingDocModeTab = null;

function _getMorphDurationMs(el) {
    var duration = 750;
    if (!el) return duration;
    var custom = getComputedStyle(el).getPropertyValue('--vd-morph-duration');
    if (custom) {
        var parsed = parseFloat(custom);
        if (!isNaN(parsed)) duration = parsed * (custom.indexOf('ms') !== -1 ? 1 : 1000);
    }
    return duration;
}

function _setToggleContent(el, tabKey) {
    var isGuides = tabKey === 'guides';
    var icon = el.querySelector('.doc-water-icon');
    var label = el.querySelector('.doc-water-label');
    if (icon) icon.className = isGuides ? 'doc-water-icon ph ph-compass' : 'doc-water-icon ph ph-cube';
    if (label) label.textContent = isGuides ? 'Guides' : 'Components';
}

function _getToggleActionLabel(tabKey) {
    return tabKey === 'guides' ? 'Switch to Components' : 'Switch to Guides';
}

function _getToggleTooltipText(tabKey) {
    return tabKey === 'guides' ? 'Click for Components' : 'Click for Guides';
}

/** Keep .vd-morph-current before .vd-morph-next in the tree so flattened text order matches the visible state. */
function _orderDocWaterToggleLayers(toggle) {
    if (!toggle) return;
    var current = toggle.querySelector('.vd-morph-current');
    var next = toggle.querySelector('.vd-morph-next');
    if (!current || !next) return;
    if (current.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_PRECEDING) {
        toggle.insertBefore(current, next);
    }
}

function setActiveDocMode(tabKey) {
    var toggle = document.getElementById('doc-water-toggle');
    if (!toggle) return;

    var isGuides = tabKey === 'guides';
    toggle.setAttribute('aria-pressed', String(isGuides));
    toggle.setAttribute('aria-label', _getToggleActionLabel(tabKey));
    var tooltipText = _getToggleTooltipText(tabKey);
    toggle.setAttribute('data-tooltip', tooltipText);
    if (window.VanduoTooltips && typeof window.VanduoTooltips.update === 'function') {
        window.VanduoTooltips.update(toggle, tooltipText);
    }

    if (_toggleMorphing) {
        _pendingDocModeTab = tabKey;
        return;
    }
    _pendingDocModeTab = null;

    var current = toggle.querySelector('.vd-morph-current');
    var next = toggle.querySelector('.vd-morph-next');
    var oppositeTab = isGuides ? 'components' : 'guides';
    if (current) _setToggleContent(current, tabKey);
    if (next) _setToggleContent(next, oppositeTab);
    _orderDocWaterToggleLayers(toggle);
}

/* ── Navbar active state ──────────────────────── */
function setActiveNavbarLink(route) {
    document.querySelectorAll('.vd-navbar-nav .vd-nav-link').forEach(function (link) {
        var r = link.getAttribute('data-route');
        if (route === 'docs') {
            link.classList.toggle('active', r === 'docs');
        } else {
            link.classList.toggle('active', r === route);
        }
    });
}

/* ── Sidebar nav-link active state ────────────── */
function setActiveNavLink(sectionId) {
    document.querySelectorAll('.doc-nav-link').forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('data-section') === sectionId);
    });
}

function syncDocsTabState(tabKey) {
    var safeTab = tabKey === 'guides' ? 'guides' : 'components';
    var docsView = document.getElementById('docs-view');
    var docsContent = document.getElementById('dynamic-content');

    if (docsView) {
        docsView.setAttribute('data-doc-tab', safeTab);
    }
    if (docsContent) {
        docsContent.setAttribute('data-doc-tab', safeTab);
    }
}

/* ── View switching ───────────────────────────── */
function showView(view) {
    var pageView = document.getElementById('page-view');
    var docsView = document.getElementById('docs-view');
    if (view === 'docs') {
        pageView.classList.remove('is-active');
        docsView.classList.add('is-active');
        if (currentTab) {
            syncDocsTabState(currentTab);
        }
    } else {
        docsView.classList.remove('is-active');
        pageView.classList.add('is-active');
        // Reset transient docs state so the scroll-spy can't clobber the
        // new URL/title with a stale section while docs-view is hidden.
        activeDocSectionId = null;
        scrollSpyTicking = false;
        releasePendingDocNavigation(0);
    }
    currentView = view;
}

function initTemplatesPage(templateSlug) {
    var root = document.getElementById('templates');
    if (!root) return;

    rewriteTemplatePreviewLinks(root);

    var gallery = root.querySelector('[data-template-view="gallery"]');
    var details = Array.from(root.querySelectorAll('[data-template-detail]'));
    var hero = root.querySelector('.templates-hero');
    var activeDetail = templateSlug
        ? details.find(function (detail) {
            return detail.getAttribute('data-template-detail') === templateSlug;
        })
        : null;

    var inDetail = Boolean(activeDetail);
    if (gallery) gallery.hidden = inDetail;
    if (hero) hero.classList.toggle('is-collapsed', inDetail);
    details.forEach(function (detail) {
        detail.hidden = detail !== activeDetail;
    });

    if (activeDetail) {
        var title = activeDetail.querySelector('h2');
        if (title) setDocumentTitle(title.textContent + ' Template');
        requestAnimationFrame(function () {
            activeDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
            var focusTarget = activeDetail.querySelector('.template-back-link') || activeDetail;
            focusTarget.focus({ preventScroll: true });
        });
    }
}

function rewriteTemplatePreviewLinks(root) {
    var configuredBase = window.__VANDUO_TEMPLATES_BASE_URL || 'https://templates.vanduo.dev';
    var base = String(configuredBase).replace(/\/+$/, '');
    root.querySelectorAll('a[href^="https://templates.vanduo.dev/"]').forEach(function (link) {
        var sourcePath = link.getAttribute('href').replace('https://templates.vanduo.dev', '');
        link.href = base + sourcePath;
    });
}

/* ── Page loading (Home / About / Changelog) ── */
async function loadPage(pageId, options = {}) {
    hideDocScrollLoader();
    if (currentView === pageId && document.getElementById(pageId)) {
        if (pageId === 'templates') {
            initTemplatesPage(options.templateSlug || null);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    showView(pageId);
    setActiveNavbarLink(pageId);
    var container = document.getElementById('page-view');

    destroyVanduoScope(container);
    container.innerHTML = getPagePlaceholderHtml();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    var page = findPageMeta(pageId);
    if (!page) {
        container.innerHTML = '<div class="vd-alert vd-alert-error" style="margin: 2rem;">Page not found.</div>';
        return;
    }
    try {
        setDocumentTitle(page.title);
        var res = await fetch(withDocsContentVersion(SECTIONS_BASE + page.file), { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load ' + page.file);
        var html = await res.text();
        safeInjectHtml(container, html);
        initVanduoScope(container);
        hideDisabledCodeTabs(container);
        wireRouteLinks(container);
        initChangelogPagination(pageId, container);
        initHexGridDemo();
        if (pageId === 'templates') {
            initTemplatesPage(options.templateSlug || null);
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="vd-alert vd-alert-error" style="margin: 2rem;">Failed to load page. Check console.</div>';
    }
}

/* ── Section loading (docs) ───────────────────── */
function getCurrentDocOrderedIds() {
    return currentTab ? getOrderedIds(currentTab) : [];
}

function getLoadedDocSectionRange() {
    var orderedIds = getCurrentDocOrderedIds();
    var firstIndex = -1;
    var lastIndex = -1;

    for (var i = 0; i < orderedIds.length; i++) {
        if (!document.getElementById(orderedIds[i])) continue;
        if (firstIndex === -1) firstIndex = i;
        lastIndex = i;
    }

    if (firstIndex === -1 || lastIndex === -1) return null;

    return {
        orderedIds: orderedIds,
        firstIndex: firstIndex,
        lastIndex: lastIndex,
        firstId: orderedIds[firstIndex],
        lastId: orderedIds[lastIndex]
    };
}

function getNeighborSectionId(sectionId, offset) {
    if (!sectionId || !currentTab || !offset) return null;
    var orderedIds = getCurrentDocOrderedIds();
    var index = orderedIds.indexOf(sectionId);
    if (index === -1) return null;
    var neighborIndex = index + offset;
    if (neighborIndex < 0 || neighborIndex >= orderedIds.length) return null;
    return orderedIds[neighborIndex];
}

function prefetchDocNeighborsAround(sectionId, radius = DOC_NEIGHBOR_PREFETCH_RADIUS) {
    if (!sectionId || !currentTab) return;
    for (var step = 1; step <= radius; step++) {
        var prevId = getNeighborSectionId(sectionId, -step);
        var nextId = getNeighborSectionId(sectionId, step);
        if (prevId) prefetchSection(prevId);
        if (nextId) prefetchSection(nextId);
    }
}

function removeDocBoundarySentinel(sentinelEl) {
    if (sentinelEl && sentinelEl.parentNode) {
        sentinelEl.parentNode.removeChild(sentinelEl);
    }
}

function disconnectDocBoundaryObservers() {
    if (docTopBoundaryObserver) {
        docTopBoundaryObserver.disconnect();
    }
    if (docBottomBoundaryObserver) {
        docBottomBoundaryObserver.disconnect();
    }
}

function disarmDocBoundaries() {
    docTopBoundaryArmed = false;
    docBottomBoundaryArmed = false;
    disconnectDocBoundaryObservers();
}

function resetDocsSectionRenderState(options = {}) {
    var container = document.getElementById('dynamic-content');

    docContentEpoch += 1;
    disarmDocBoundaries();
    removeDocBoundarySentinel(docTopBoundaryEl);
    removeDocBoundarySentinel(docBottomBoundaryEl);
    docTopBoundaryEl = null;
    docBottomBoundaryEl = null;
    docBoundaryPrevLoading = false;
    docBoundaryNextLoading = false;
    docLastKnownScrollY = window.scrollY || window.pageYOffset || 0;

    if (scrollSpyObserver) {
        scrollSpyObserver.disconnect();
        scrollSpyObserver = null;
    }
    activeDocSectionId = null;
    scrollSpyTicking = false;
    loadedSections.clear();
    loadingSections.clear();

    if (!container) return;

    if (options.destroyScope !== false) {
        destroyVanduoScope(container);
    }
    container.innerHTML = '';
}

function isDocContentStale(loadEpoch) {
    return loadEpoch !== docContentEpoch;
}

function createDocBoundarySentinel(id) {
    var sentinel = document.getElementById(id);
    if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = id;
        sentinel.style.height = '1px';
        sentinel.style.width = '100%';
        sentinel.setAttribute('aria-hidden', 'true');
    }
    return sentinel;
}

function ensureDocBoundarySentinels() {
    docTopBoundaryEl = createDocBoundarySentinel(DOC_TOP_BOUNDARY_SENTINEL_ID);
    docBottomBoundaryEl = createDocBoundarySentinel(DOC_BOTTOM_BOUNDARY_SENTINEL_ID);
}

function ensureDocBoundaryObserver(direction) {
    if (direction === 'top') {
        if (!docTopBoundaryObserver) {
            docTopBoundaryObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting || !docTopBoundaryArmed || docBoundaryPrevLoading) return;
                    docTopBoundaryArmed = false;
                    disconnectDocBoundaryObservers();
                    loadPreviousSection();
                });
            }, { rootMargin: DOC_BOUNDARY_ROOT_MARGIN, threshold: 0 });
        }
        return docTopBoundaryObserver;
    }

    if (!docBottomBoundaryObserver) {
        docBottomBoundaryObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting || !docBottomBoundaryArmed || docBoundaryNextLoading) return;
                docBottomBoundaryArmed = false;
                disconnectDocBoundaryObservers();
                loadNextSection();
            });
        }, { rootMargin: DOC_BOUNDARY_ROOT_MARGIN, threshold: 0 });
    }
    return docBottomBoundaryObserver;
}

function syncDocBoundarySentinels() {
    var container = document.getElementById('dynamic-content');
    var range = getLoadedDocSectionRange();

    if (!container || !range) {
        removeDocBoundarySentinel(docTopBoundaryEl);
        removeDocBoundarySentinel(docBottomBoundaryEl);
        return;
    }

    ensureDocBoundarySentinels();

    var firstSection = document.getElementById(range.firstId);
    var lastSection = document.getElementById(range.lastId);
    var topCandidateId = range.firstIndex > 0 ? range.orderedIds[range.firstIndex - 1] : null;
    var bottomCandidateId = range.lastIndex < range.orderedIds.length - 1 ? range.orderedIds[range.lastIndex + 1] : null;

    if (topCandidateId && firstSection) {
        container.insertBefore(docTopBoundaryEl, firstSection);
    } else {
        docTopBoundaryArmed = false;
        removeDocBoundarySentinel(docTopBoundaryEl);
    }

    if (bottomCandidateId && lastSection) {
        container.insertBefore(docBottomBoundaryEl, lastSection.nextSibling);
    } else {
        docBottomBoundaryArmed = false;
        removeDocBoundarySentinel(docBottomBoundaryEl);
    }
}

function observeArmedDocBoundaries() {
    disconnectDocBoundaryObservers();
    syncDocBoundarySentinels();

    if (docTopBoundaryArmed && docTopBoundaryEl && docTopBoundaryEl.isConnected) {
        ensureDocBoundaryObserver('top').observe(docTopBoundaryEl);
    }

    if (docBottomBoundaryArmed && docBottomBoundaryEl && docBottomBoundaryEl.isConnected) {
        ensureDocBoundaryObserver('bottom').observe(docBottomBoundaryEl);
    }
}

function armDocBoundary(direction) {
    var range = getLoadedDocSectionRange();
    if (!range) return;

    if (direction === 'up') {
        if (range.firstIndex <= 0 || docBoundaryPrevLoading) return;
        docTopBoundaryArmed = true;
        docBottomBoundaryArmed = false;
    } else if (direction === 'down') {
        if (range.lastIndex >= range.orderedIds.length - 1 || docBoundaryNextLoading) return;
        docBottomBoundaryArmed = true;
        docTopBoundaryArmed = false;
    } else {
        return;
    }

    observeArmedDocBoundaries();
}

function handleDocBoundaryScroll() {
    var nextScrollY = window.scrollY || window.pageYOffset || 0;

    if (nextScrollY < docLastKnownScrollY - 1) {
        armDocBoundary('up');
    } else if (nextScrollY > docLastKnownScrollY + 1) {
        armDocBoundary('down');
    }

    docLastKnownScrollY = nextScrollY;
    requestActiveDocSectionUpdate();
}

function waitForLoadingSection(sectionId, signal, timeoutMs = 5000) {
    if (loadedSections.has(sectionId)) return Promise.resolve(true);
    if (!loadingSections.has(sectionId)) return Promise.resolve(false);

    var deadline = Date.now() + timeoutMs;
    return new Promise(function (resolve) {
        function check() {
            if (signal && signal.aborted) {
                resolve(false);
                return;
            }
            if (loadedSections.has(sectionId)) {
                resolve(true);
                return;
            }
            if (!loadingSections.has(sectionId) || Date.now() >= deadline) {
                resolve(false);
                return;
            }
            window.requestAnimationFrame(check);
        }
        window.requestAnimationFrame(check);
    });
}

async function loadSection(sectionId, autoScroll = true, options = {}) {
    var signal = options.signal;
    var skipInfiniteRefresh = options.skipInfiniteRefresh === true;
    var skipRunway = options.skipRunway === true;
    var loadEpoch = docContentEpoch;
    if (signal && signal.aborted) return;

    if (autoScroll && requestedDocScrollLoaderSectionId === sectionId) {
        showDocScrollLoader(sectionId);
        requestedDocScrollLoaderSectionId = null;
    }

    if (autoScroll) {
        pendingDocNavigationId = sectionId;
    }

    if (loadedSections.has(sectionId)) {
        var el = document.getElementById(sectionId);
        var loadedMeta = findSectionMeta(sectionId);
        // 'instant' — deep-link/search to an already-loaded but far-away
        // section (e.g. bottom-of-sidebar like 'glass') can animate for
        // longer than the scroll-spy guard, letting spy hijack the URL
        // mid-scroll. 'instant' also bypasses the global
        // `html { scroll-behavior: smooth }` override.
        if (el && autoScroll) el.scrollIntoView({ behavior: 'instant', block: 'start' });
        if (autoScroll) settleDocScrollLoader(sectionId);
        setActiveNavLink(sectionId);
        if (loadedMeta && loadedMeta.section) {
            setDocumentTitle(loadedMeta.section.title);
            if (autoScroll && window.history && window.history.replaceState) {
                window.history.replaceState(null, '', '#docs/' + sectionId);
            }
            activeDocSectionId = sectionId;
            disarmDocBoundaries();
            prefetchDocNeighborsAround(sectionId);
        }
        return;
    }

    var meta = findSectionMeta(sectionId);
    if (!meta) {
        return;
    }

    if (autoScroll && currentTab === meta.tab && loadedSections.size > 0) {
        resetDocsSectionRenderState();
        loadEpoch = docContentEpoch;
    }

    if (loadingSections.has(sectionId)) {
        if (autoScroll) {
            var becameAvailable = await waitForLoadingSection(sectionId, signal);
            if (signal && signal.aborted) return;
            if (becameAvailable) {
                var pendingTarget = document.getElementById(sectionId);
                if (pendingTarget) pendingTarget.scrollIntoView({ behavior: 'instant', block: 'start' });
                settleDocScrollLoader(sectionId);
                setActiveNavLink(sectionId);
                setDocumentTitle(meta.section.title);
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', '#docs/' + sectionId);
                }
                activeDocSectionId = sectionId;
                disarmDocBoundaries();
                prefetchDocNeighborsAround(sectionId);
            }
        }
        return;
    }
    loadingSections.add(sectionId);

    var container = document.getElementById('dynamic-content');
    if (!container) {
        loadingSections.delete(sectionId);
        return;
    }
    var orderedIds = getOrderedIds(meta.tab);

    var placeholder = document.createElement('div');
    placeholder.id = 'dynamic-placeholder-' + sectionId;
    placeholder.innerHTML = getLoadingPlaceholderHtml();

    var myIndex = orderedIds.indexOf(sectionId);
    var insertBeforeEl = null;
    for (var i = myIndex + 1; i < orderedIds.length; i++) {
        var existing = document.getElementById(orderedIds[i])
            || document.getElementById('dynamic-placeholder-' + orderedIds[i]);
        if (existing) { insertBeforeEl = existing; break; }
    }
    if (insertBeforeEl) {
        container.insertBefore(placeholder, insertBeforeEl);
    } else {
        container.appendChild(placeholder);
    }

    // No scroll to placeholder — we only scroll once, to the real content below.
    setActiveNavLink(sectionId);

    try {
        var html = getCachedSectionHtml(sectionId);
        if (!html) {
            var url = SECTIONS_BASE + meta.section.file;
            var res = await fetch(withDocsContentVersion(url), { signal: signal, cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to load ' + url);
            html = await res.text();
            setCachedSectionHtml(sectionId, html);
        }
        if (signal && signal.aborted) {
            placeholder.remove();
            return;
        }
        if (isDocContentStale(loadEpoch)) {
            placeholder.remove();
            return;
        }
        var wrap = document.createElement('div');
        safeInjectHtml(wrap, html);
        var sectionEl = wrap.querySelector('#' + sectionId) || wrap.firstElementChild;
        if (sectionEl) {
            if (isDocContentStale(loadEpoch)) {
                placeholder.remove();
                return;
            }
            if (document.startViewTransition && autoScroll) {
                await document.startViewTransition(function () {
                    container.replaceChild(sectionEl, placeholder);
                }).finished;
            } else {
                container.replaceChild(sectionEl, placeholder);
            }
            if (isDocContentStale(loadEpoch)) {
                if (sectionEl.parentNode === container) {
                    container.removeChild(sectionEl);
                }
                return;
            }
            loadedSections.add(sectionId);
            initVanduoScope(sectionEl);
            hideDisabledCodeTabs(sectionEl);
            wireRouteLinks(sectionEl);
            initSectionDemos(sectionEl);
            // Incrementally observe the new section element rather than
            // rebuilding the entire observer on every load.
            observeSection(sectionEl);
        } else {
            placeholder.remove();
        }
        if (!skipInfiniteRefresh) {
            setupInfiniteScroll();
        }

        var target = document.getElementById(sectionId);
        // 'instant' (not 'auto') — the global `html { scroll-behavior: smooth }`
        // in css/app.css makes 'auto' fall back to smooth, which gets cancelled
        // or mis-targeted by concurrent layout shifts from in-flight Vanduo.init
        // on preloaded siblings. 'instant' bypasses CSS scroll-behavior.
        if (target && autoScroll) target.scrollIntoView({ behavior: 'instant', block: 'start' });
        if (autoScroll) settleDocScrollLoader(sectionId);

        if (autoScroll) {
            setActiveNavLink(sectionId);
            setDocumentTitle(meta.section.title);
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', '#docs/' + sectionId);
            }
            activeDocSectionId = sectionId;
            disarmDocBoundaries();
            prefetchDocNeighborsAround(sectionId);
            if (!skipRunway) {
                await ensureDocsScrollRunway(sectionId, { signal: signal });
            }
        }
    } catch (err) {
        if (err && err.name === 'AbortError') {
            placeholder.remove();
            return;
        }
        hideDocScrollLoader();
        placeholder.remove();
        console.error(err);
        container.insertAdjacentHTML('beforeend',
            '<div class="vd-alert vd-alert-error">Failed to load section. Check console.</div>');
    } finally {
        loadingSections.delete(sectionId);
    }
}

/* ── Switch docs tab ──────────────────────────── */
async function switchTab(tabKey, options = {}) {
    var signal = options.signal;
    if (signal && signal.aborted) return;
    hideDocScrollLoader();
    if (currentTab === tabKey) return;
    currentTab = tabKey;
    setActiveDocMode(tabKey);
    syncDocsTabState(tabKey);

    resetDocsSectionRenderState();
    buildSidebar(tabKey);
    closeMobileToc();

    var orderedIds = getOrderedIds(tabKey);
    var targetId = options.initialSectionId
        || (orderedIds.length > 0 ? orderedIds[0] : null);
    if (targetId) {
        await loadSection(targetId, true, { signal: signal });
    }
}

/* ── Scroll-spy ───────────────────────────────── */
const SCROLL_SPY_OFFSET = 96;
const ACTIVE_DOC_SECTION_TOLERANCE = 24;

function syncActiveDocSection(sectionId) {
    if (!sectionId) return;
    var docsView = document.getElementById('docs-view');
    if (!docsView || !docsView.classList.contains('is-active')) return;
    if (pendingDocNavigationId && sectionId !== pendingDocNavigationId) return;
    activeDocSectionId = sectionId;
    setActiveNavLink(sectionId);
    var meta = findSectionMeta(sectionId);
    if (meta && meta.section) {
        setDocumentTitle(meta.section.title);
        if (window.history && window.history.replaceState) {
            var targetHashBase = '#docs/' + sectionId;
            if (!window.location.hash.startsWith(targetHashBase)) {
                window.history.replaceState(null, '', targetHashBase);
            }
        }
    }
    prefetchDocNeighborsAround(sectionId);
}

function getActiveDocSectionId() {
    if (!currentTab) return null;
    var orderedIds = getOrderedIds(currentTab);
    var firstLoadedId = null;
    var activeId = null;

    for (var i = 0; i < orderedIds.length; i++) {
        var id = orderedIds[i];
        var sectionEl = document.getElementById(id);
        if (!sectionEl) continue;

        if (!firstLoadedId) firstLoadedId = id;

        if (sectionEl.getBoundingClientRect().top <= (SCROLL_SPY_OFFSET + ACTIVE_DOC_SECTION_TOLERANCE)) {
            activeId = id;
            continue;
        }

        break;
    }

    return activeId || firstLoadedId;
}

function updateActiveDocSection() {
    scrollSpyTicking = false;
    var docsView = document.getElementById('docs-view');
    if (!docsView || !docsView.classList.contains('is-active')) return;
    var nextSectionId = getActiveDocSectionId();
    if (!nextSectionId || nextSectionId === activeDocSectionId) return;
    syncActiveDocSection(nextSectionId);
}

function requestActiveDocSectionUpdate() {
    if (scrollSpyTicking) return;
    scrollSpyTicking = true;
    window.requestAnimationFrame(updateActiveDocSection);
}

function createScrollSpyObserver() {
    return new IntersectionObserver(function () {
        requestActiveDocSectionUpdate();
    }, {
        rootMargin: '-' + SCROLL_SPY_OFFSET + 'px 0px -55% 0px',
        threshold: [0, 1]
    });
}

// Observe a single newly-inserted section (incremental — no observer teardown).
function observeSection(sectionEl) {
    if (!sectionEl || !sectionEl.id) return;
    if (!scrollSpyObserver) {
        scrollSpyObserver = createScrollSpyObserver();
    }
    scrollSpyObserver.observe(sectionEl);
    requestActiveDocSectionUpdate();
}

// Full reset — only called on tab switches, not per-section load.
function setupScrollSpy() {
    activeDocSectionId = null;
    if (scrollSpyObserver) {
        scrollSpyObserver.disconnect();
    }
    scrollSpyObserver = createScrollSpyObserver();
    var content = document.getElementById('dynamic-content');
    if (!content) return;
    content.querySelectorAll('section[id]').forEach(function (sec) {
        scrollSpyObserver.observe(sec);
    });
    requestActiveDocSectionUpdate();
}

function setupInfiniteScroll() {
    syncDocBoundarySentinels();
    observeArmedDocBoundaries();
}

function getFirstLoadedSectionElement() {
    var range = getLoadedDocSectionRange();
    return range ? document.getElementById(range.firstId) : null;
}

function getLastLoadedSectionElement() {
    var range = getLoadedDocSectionRange();
    return range ? document.getElementById(range.lastId) : null;
}

async function ensureDocsScrollRunway(sectionId, options = {}) {
    if (options.signal && options.signal.aborted) return;
    var range = getLoadedDocSectionRange();
    if (!range || range.lastId !== sectionId) return;

    var lastSection = getLastLoadedSectionElement();
    if (!lastSection) return;

    if (lastSection.getBoundingClientRect().bottom > window.innerHeight - DOC_RUNWAY_BOTTOM_THRESHOLD) {
        return;
    }

    await loadNextSection({ skipInfiniteRefresh: true });
    if (options.signal && options.signal.aborted) return;
    setupInfiniteScroll();
}

async function loadPreviousSection(options = {}) {
    if (!currentTab || docBoundaryPrevLoading) return false;

    var range = getLoadedDocSectionRange();
    if (!range || range.firstIndex <= 0) return false;

    var previousSectionId = range.orderedIds[range.firstIndex - 1];
    var anchorEl = getFirstLoadedSectionElement();
    var anchorTop = anchorEl ? anchorEl.getBoundingClientRect().top : null;

    docBoundaryPrevLoading = true;
    try {
        await loadSection(previousSectionId, false, {
            skipInfiniteRefresh: true,
            skipRunway: true
        });

        if (anchorEl && anchorEl.isConnected && anchorTop != null) {
            var nextTop = anchorEl.getBoundingClientRect().top;
            var delta = nextTop - anchorTop;
            if (Math.abs(delta) > 1) {
                window.scrollTo({
                    top: (window.scrollY || window.pageYOffset || 0) + delta,
                    behavior: 'instant'
                });
            }
        }

        requestActiveDocSectionUpdate();
        prefetchDocNeighborsAround(activeDocSectionId || previousSectionId);
        return true;
    } finally {
        docBoundaryPrevLoading = false;
        if (!options.skipInfiniteRefresh) {
            setupInfiniteScroll();
        }
    }
}

async function loadNextSection(options = {}) {
    if (!currentTab || docBoundaryNextLoading) return false;

    var range = getLoadedDocSectionRange();
    if (!range || range.lastIndex >= range.orderedIds.length - 1) return false;

    var nextSectionId = range.orderedIds[range.lastIndex + 1];

    docBoundaryNextLoading = true;
    try {
        await loadSection(nextSectionId, false, {
            skipInfiniteRefresh: true,
            skipRunway: true
        });
        requestActiveDocSectionUpdate();
        prefetchDocNeighborsAround(activeDocSectionId || nextSectionId);
        return true;
    } finally {
        docBoundaryNextLoading = false;
        if (!options.skipInfiniteRefresh) {
            setupInfiniteScroll();
        }
    }
}

/* ── Wire data-route links ────────────────────── */
function wireRouteLinks(container) {
    if (!container) return;
    container.querySelectorAll('[data-route]').forEach(function (el) {
        if (el._routeWired) return;
        el._routeWired = true;
        el.addEventListener('click', function (e) {
            e.preventDefault();
            var route = el.getAttribute('data-route');
            navigate(route);
        });
    });
}

/* ── Changelog pagination ─────────────────────── */
function initChangelogPagination(pageId, container) {
    if (pageId !== 'changelog' || !container) return;

    var section = container.querySelector('#changelog');
    if (!section) return;

    var cards = Array.from(section.querySelectorAll('article.version-card'));
    if (!cards.length) return;

    var nav = section.querySelector('#changelog-pagination-nav');
    var pagination = section.querySelector('#changelog-pagination');
    if (!nav || !pagination) return;

    var pageSize = 3;
    var totalPages = Math.ceil(cards.length / pageSize);

    function applyPage(pageNumber) {
        var safePage = Math.max(1, Math.min(totalPages, pageNumber || 1));
        cards.forEach(function (card, index) {
            var cardPage = Math.floor(index / pageSize) + 1;
            var isVisible = cardPage === safePage;
            card.hidden = !isVisible;
            card.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
        });

        if (typeof window.VanduoPagination !== 'undefined' && typeof window.VanduoPagination.update === 'function') {
            window.VanduoPagination.update(pagination, {
                totalPages: totalPages,
                currentPage: safePage,
                maxVisible: 7
            });
        } else {
            pagination.dataset.totalPages = String(totalPages);
            pagination.dataset.currentPage = String(safePage);
            pagination.dataset.maxVisible = '7';
        }
    }

    if (pagination._changelogPageHandler) {
        pagination.removeEventListener('pagination:change', pagination._changelogPageHandler);
    }

    pagination.dataset.totalPages = String(totalPages);
    pagination.dataset.currentPage = '1';
    pagination.dataset.maxVisible = '7';

    nav.hidden = totalPages <= 1;
    applyPage(1);

    pagination._changelogPageHandler = function (e) {
        var detailPage = e && e.detail ? Number(e.detail.page) : 1;
        applyPage(detailPage);
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    pagination.addEventListener('pagination:change', pagination._changelogPageHandler);
}

/* ── Initialize vd-hex demo on Labs page ───────── */
// Module-level ref so we can destroy the previous instance before re-initialising
// (prevents MutationObserver leak when the SPA navigates away and back to Labs).
var _hexGridInstance = null;
var _hexGridDemoScope = null;

function initHexGridDemo(scope) {
    var containerRoot = scope || document;
    var scopeToken = scope && scope.id ? scope.id : 'global';

    var demoContainer = (containerRoot && containerRoot.querySelector)
        ? containerRoot.querySelector('#hex-demo-container')
        : document.getElementById('hex-demo-container');
    var demoCanvas = (containerRoot && containerRoot.querySelector)
        ? containerRoot.querySelector('#hex-demo')
        : document.getElementById('hex-demo');

    if (!demoContainer || !demoCanvas) return;

    var isNewScope = _hexGridDemoScope !== scopeToken
        || !_hexGridInstance
        || !_hexGridInstance.element
        || !_hexGridInstance.element.isConnected
        || (_hexGridInstance.element !== demoContainer);

    if (isNewScope && _hexGridInstance) {
        _hexGridInstance.destroy();
        _hexGridInstance = null;
    }

    if (_hexGridInstance) return;

    // Dynamic import to avoid loading on other pages
    import('./hex-grid.js').then(function (module) {
        var VdHexGrid = module.VdHexGrid;
        var sizeSlider = containerRoot.querySelector('#hex-size-slider');
        var widthSlider = containerRoot.querySelector('#hex-width-slider');
        var heightSlider = containerRoot.querySelector('#hex-height-slider');
        var rotationSlider = containerRoot.querySelector('#hex-rotation-slider');

        var grid = new VdHexGrid({
            element: demoContainer,
            canvas: demoCanvas,
            size: parseInt(sizeSlider && sizeSlider.value || '30', 10),
            width: parseInt(widthSlider && widthSlider.value || '15', 10),
            height: parseInt(heightSlider && heightSlider.value || '10', 10)
        });
        _hexGridInstance = grid;
        _hexGridDemoScope = scopeToken;

        // Wire up controls
        var sizeValue = containerRoot.querySelector('#hex-size-value');
        var widthValue = containerRoot.querySelector('#hex-width-value');
        var heightValue = containerRoot.querySelector('#hex-height-value');
        var rotationValue = containerRoot.querySelector('#hex-rotation-value');
        var resetBtn = containerRoot.querySelector('#hex-reset-btn');
        var fillBtn = containerRoot.querySelector('#hex-fill-btn');
        var infoCard = containerRoot.querySelector('#hex-info-card');

        // Toolbar buttons
        var zoomInBtn = containerRoot.querySelector('#hex-zoom-in');
        var zoomOutBtn = containerRoot.querySelector('#hex-zoom-out');
        var resetViewBtn = containerRoot.querySelector('#hex-reset-view');
        var zoomLevelSpan = containerRoot.querySelector('#hex-zoom-level');

        if (sizeSlider && sizeValue) {
            sizeSlider.addEventListener('input', function (e) {
                sizeValue.textContent = e.target.value + 'px';
                grid.setSize(parseInt(e.target.value, 10));
            });
        }

        if (widthSlider && widthValue) {
            widthSlider.addEventListener('input', function (e) {
                widthValue.textContent = e.target.value;
                grid.setDimensions(parseInt(e.target.value, 10), grid.height);
            });
        }

        if (heightSlider && heightValue) {
            heightSlider.addEventListener('input', function (e) {
                heightValue.textContent = e.target.value;
                grid.setDimensions(grid.width, parseInt(e.target.value, 10));
            });
        }

        if (rotationSlider && rotationValue) {
            rotationSlider.addEventListener('input', function (e) {
                var deg = parseInt(e.target.value, 10);
                rotationValue.textContent = deg + '\u00b0';
                grid.setRotation(deg * Math.PI / 180);
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                if (sizeSlider) sizeSlider.value = '30';
                if (widthSlider) widthSlider.value = '15';
                if (heightSlider) heightSlider.value = '10';
                if (rotationSlider) rotationSlider.value = '0';
                if (sizeValue) sizeValue.textContent = '30px';
                if (widthValue) widthValue.textContent = '15';
                if (heightValue) heightValue.textContent = '10';
                if (rotationValue) rotationValue.textContent = '0\u00b0';
                grid.reset();
            });
        }

        if (fillBtn) {
            fillBtn.addEventListener('click', function () {
                grid.fillRandom();
            });
        }

        // Toolbar button handlers
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', function () {
                grid.zoomIn();
            });
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', function () {
                grid.zoomOut();
            });
        }

        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', function () {
                grid.resetView();
            });
        }

        // Listen for zoom events to update zoom level indicator
        grid.on('zoom', function (data) {
            if (zoomLevelSpan) {
                var percent = Math.round(data.scale * 100);
                zoomLevelSpan.textContent = percent + '%';
            }
        });

        // Listen for selection events
        grid.on('select', function (hex) {
            if (infoCard) infoCard.style.display = 'block';
            var coords = containerRoot.querySelector('#hex-coords');
            var pixelX = containerRoot.querySelector('#hex-pixel-x');
            var pixelY = containerRoot.querySelector('#hex-pixel-y');
            var adjacent = containerRoot.querySelector('#hex-adjacent');

            if (coords) coords.textContent = '(' + hex.q + ', ' + hex.r + ')';
            if (pixelX) pixelX.textContent = Math.round(hex.x);
            if (pixelY) pixelY.textContent = Math.round(hex.y);
            if (adjacent) adjacent.textContent = (hex.adjacent && hex.adjacent.length) || 0;
        });
    }).catch(function (err) {
        console.error('Failed to load VdHexGrid:', err);
    });
}

/* ── Router ───────────────────────────────────── */
function parseHash(hash) {
    var h = (hash || '').replace(/^#\/?/, '');
    if (!h || h === 'home') return { view: 'home' };
    if (h === 'about') return { view: 'about' };
    if (h === 'changelog') return { view: 'changelog' };
    if (h === 'templates') return { view: 'templates' };
    if (h.startsWith('templates/')) return { view: 'templates', template: h.slice(10).split('/')[0] };
    if (h === 'kilo-oss') return { view: 'kilo-oss' };
    if (h === 'docs') return { view: 'docs-landing' };
    if (h === 'docs/components') return { view: 'docs', tab: 'components', section: null };
    if (h === 'docs/guides') return { view: 'docs', tab: 'guides', section: null };
    if (h.startsWith('docs/')) {
        var fullPath = h.slice(5);
        var routePath = fullPath.split('#')[0];
        var segments = routePath.split('/').filter(Boolean);
        if (segments.length >= 2 && (segments[0] === 'components' || segments[0] === 'guides')) {
            var legacySectionId = segments[1];
            var legacyTabKey = getTabForSection(legacySectionId);
            if (legacyTabKey) return { view: 'docs', tab: legacyTabKey, section: legacySectionId };
            return { view: 'docs', tab: segments[0], section: null };
        }
        var sectionId = routePath;
        var tabKey = getTabForSection(sectionId);
        if (tabKey) return { view: 'docs', tab: tabKey, section: sectionId };
        return { view: 'docs', tab: 'components', section: null };
    }
    return { view: 'home' };
}

async function navigate(route, options) {
    primeDocNavigationForHash('#' + route, options);
    if (window.history && window.history.pushState) {
        window.history.pushState(null, '', '#' + route);
    }
    await handleRoute();
}

async function handleRoute() {
    if (currentNavigationController) {
        currentNavigationController.abort();
    }
    currentNavigationController = new AbortController();
    var signal = currentNavigationController.signal;

    var parsed = parseHash(location.hash);

    if (parsed.view === 'home' || parsed.view === 'about' || parsed.view === 'changelog' || parsed.view === 'templates' || parsed.view === 'kilo-oss' || parsed.view === 'docs-landing') {
        await loadPage(parsed.view, { templateSlug: parsed.template });
        if (parsed.view === 'docs-landing') {
            setActiveNavbarLink('docs');
        }
        return;
    }

    showView('docs');
    setActiveNavbarLink('docs');

    if (currentTab !== parsed.tab) {
        await switchTab(parsed.tab, {
            signal: signal,
            initialSectionId: parsed.section || undefined
        });
    } else if (parsed.section) {
        await loadSection(parsed.section, true, { signal: signal });
    }
}

/* ── Section-specific demo wiring ─────────────── */
function initSectionDemos(sectionEl) {
    if (!sectionEl) return;

    sectionEl.querySelectorAll('[data-fab-speed-dial-toggle]').forEach(function (toggle) {
        if (toggle._fabSpeedDialInit) return;
        toggle._fabSpeedDialInit = true;
        toggle.addEventListener('click', function (e) {
            e.preventDefault();
            var menu = toggle.closest('.vd-fab-menu');
            if (!menu) return;
            menu.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', menu.classList.contains('is-open') ? 'true' : 'false');
        });
    });

    sectionEl.querySelectorAll('[data-demo-no-nav]').forEach(function (link) {
        if (link._demoNoNavInit) return;
        link._demoNoNavInit = true;
        link.addEventListener('click', function (e) {
            e.preventDefault();
        });
    });

    sectionEl.querySelectorAll('[data-stepper-demo-control]').forEach(function (button) {
        if (button._stepperDemoControlInit) return;
        button._stepperDemoControlInit = true;
        button.addEventListener('click', function (e) {
            e.preventDefault();
            var action = button.getAttribute('data-stepper-demo-control');
            var targetSelector = button.getAttribute('data-stepper-target');
            var stepper = targetSelector ? sectionEl.querySelector(targetSelector) : null;
            if (!stepper && targetSelector) {
                stepper = document.querySelector(targetSelector);
            }
            if (!stepper || !window.VanduoStepper) return;

            if (action === 'next') {
                window.VanduoStepper.next(stepper);
            } else if (action === 'prev') {
                window.VanduoStepper.prev(stepper);
            }
        });
    });

    sectionEl.querySelectorAll('[data-vd-morph="manual"][data-morph-states]').forEach(function (badge) {
        if (badge._morphBadgeInit) return;
        badge._morphBadgeInit = true;
        var states  = JSON.parse(badge.getAttribute('data-morph-states')  || '[]');
        var classes = JSON.parse(badge.getAttribute('data-morph-classes') || '[]');
        var icons   = JSON.parse(badge.getAttribute('data-morph-icons')  || '[]');
        var idx = 0;
        var morphing = false;

        var morphMs = 750;
        try {
            var d = getComputedStyle(badge).getPropertyValue('--vd-morph-duration').trim();
            if (d) {
                var parsed = parseFloat(d);
                if (!isNaN(parsed)) morphMs = parsed * (d.indexOf('ms') !== -1 ? 1 : 1000);
            }
        } catch (_e) { /* noop */ }

        badge.addEventListener('click', function (e) {
            if (morphing) return;
            morphing = true;

            var nextIdx = (idx + 1) % states.length;
            var afterIdx = (nextIdx + 1) % states.length;

            var next = badge.querySelector('.vd-morph-next');
            if (next) {
                setMorphBadgeContent(next, icons[nextIdx], states[nextIdx]);
            }

            var wave = badge.querySelector('.vd-morph-wave');
            if (wave) {
                var rect = badge.getBoundingClientRect();
                wave.style.left = ((e.clientX || rect.left + rect.width / 2) - rect.left) + 'px';
                wave.style.top  = ((e.clientY || rect.top  + rect.height / 2) - rect.top) + 'px';
            }

            badge.classList.add('is-morphing');

            setTimeout(function () {
                badge.classList.remove('is-morphing');

                classes.forEach(function (c) { badge.classList.remove(c); });
                badge.classList.add(classes[nextIdx]);

                var current = badge.querySelector('.vd-morph-current');
                var nextEl  = badge.querySelector('.vd-morph-next');
                if (current) {
                    setMorphBadgeContent(current, icons[nextIdx], states[nextIdx]);
                }
                if (nextEl) {
                    setMorphBadgeContent(nextEl, icons[afterIdx], states[afterIdx]);
                }

                idx = nextIdx;
                morphing = false;
            }, morphMs);
        });
    });

    if (sectionEl.id === 'vd-hex') {
        initHexGridDemo(sectionEl);
    }

    if (sectionEl.id === 'music-player') {
        initMusicPlayerDemos(sectionEl);
    }

    if (sectionEl.id === 'toasts') {
        initToastDemos(sectionEl);
    }
}

/* ── Music Player demo wiring ─────────────────── */
function initMusicPlayerDemos(sectionEl) {
    var MP = window.VanduoMusicPlayer;
    if (!MP) return;

    var d1 = sectionEl.querySelector('#demo-detach');
    var d2 = sectionEl.querySelector('#demo-floating-pro');

    var btnDetach  = sectionEl.querySelector('#btn-detach-demo');
    var btnAttach  = sectionEl.querySelector('#btn-attach-demo');
    if (btnDetach && d1) {
        btnDetach.addEventListener('click', function () { MP.detach(d1, 'bottom-left'); });
    }
    if (btnAttach && d1) {
        btnAttach.addEventListener('click', function () { MP.attach(d1); });
    }

    var btnFloatPro    = sectionEl.querySelector('#btn-float-pro');
    var btnFloatExpand = sectionEl.querySelector('#btn-float-expand');
    var btnFloatAttach = sectionEl.querySelector('#btn-float-attach');
    if (btnFloatPro && d2) {
        btnFloatPro.addEventListener('click', function () {
            MP.detach(d2, 'bottom-right');
            setTimeout(function () { MP.minimize(d2); }, 150);
        });
    }
    if (btnFloatExpand && d2) {
        btnFloatExpand.addEventListener('click', function () { MP.expand(d2); });
    }
    if (btnFloatAttach && d2) {
        btnFloatAttach.addEventListener('click', function () { MP.attach(d2); });
    }
}

/* ── Toast demo wiring ────────────────────────── */
function initToastDemos(sectionEl) {
    if (!window.Toast) return;

    sectionEl.querySelectorAll('[data-toast-demo]').forEach(function (btn) {
        if (btn._toastDemoInit) return;
        btn._toastDemoInit = true;

        var demoType = btn.getAttribute('data-toast-demo');
        btn.addEventListener('click', function () {
            switch (demoType) {
                case 'success':
                    Toast.success('Operation completed successfully!');
                    break;
                case 'error':
                    Toast.error('An error occurred!');
                    break;
                case 'warning':
                    Toast.warning('Please review your input.');
                    break;
                case 'info':
                    Toast.info('Here is some information.');
                    break;
                case 'with-title':
                    Toast.show({
                        title: 'With Title',
                        message: 'This toast has a title and message.',
                        type: 'info'
                    });
                    break;
                case 'long-duration':
                    Toast.show({
                        message: 'This toast will stay for 10 seconds.',
                        type: 'success',
                        duration: 10000
                    });
                    break;
                case 'bottom-left':
                    Toast.show({
                        message: 'Bottom left position.',
                        type: 'warning',
                        position: 'bottom-left'
                    });
                    break;
            }
        });
    });
}

/* ── Event listeners ──────────────────────────── */
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

var docWaterToggle = document.getElementById('doc-water-toggle');
if (docWaterToggle) {
    docWaterToggle.addEventListener('click', function () {
        if (_toggleMorphing) return;

        var toggle = this;
        var parsed = parseHash(location.hash);
        var activeTab = currentTab || parsed.tab || 'components';
        var destTab = activeTab === 'guides' ? 'components' : 'guides';

        var next = toggle.querySelector('.vd-morph-next');
        if (next) _setToggleContent(next, destTab);

        _toggleMorphing = true;
        _pendingDocModeTab = destTab;

        var tabRoutes = { components: 'docs/components', guides: 'docs/guides' };
        navigate(tabRoutes[destTab] || 'docs/components');

        var morphDuration = _getMorphDurationMs(toggle);
        // Wait until VanduoMorph actually finishes swapping layers to avoid
        // a timer-order race that can momentarily re-apply the opposite label.
        function finalizeWhenMorphSettles() {
            if (toggle.classList.contains('is-morphing')) {
                requestAnimationFrame(finalizeWhenMorphSettles);
                return;
            }
            _toggleMorphing = false;
            var routeTab = parseHash(location.hash).tab;
            var finalTab = _pendingDocModeTab || routeTab || currentTab || destTab;
            setActiveDocMode(finalTab);
        }

        setTimeout(function () {
            requestAnimationFrame(finalizeWhenMorphSettles);
        }, morphDuration);
    }, true);
}

/* ── Track Water Morph wrapper height for sticky sidebar (--doc-tabs-height) ── */
(function () {
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
})();

/* ── Mobile TOC toggle ─────────────────────── */
var sidebarToggle = document.querySelector('.doc-sidebar-toggle');
var sidebarNav = document.querySelector('.doc-nav');
if (sidebarToggle && sidebarNav) {
    sidebarToggle.addEventListener('click', function () {
        var isOpen = sidebarNav.classList.toggle('is-open');
        sidebarToggle.classList.toggle('is-open', isOpen);
        sidebarToggle.setAttribute('aria-expanded', String(isOpen));
    });
}

function closeMobileToc() {
    if (sidebarToggle && sidebarNav) {
        sidebarNav.classList.remove('is-open');
        sidebarToggle.classList.remove('is-open');
        sidebarToggle.setAttribute('aria-expanded', 'false');
    }
}

var dynamicNavList = document.getElementById('dynamic-nav-list');
if (dynamicNavList) {
    dynamicNavList.addEventListener('click', function (e) {
        var link = e.target.closest('.doc-nav-link[data-section]');
        if (!link) return;
        e.preventDefault();
        var id = link.getAttribute('data-section');
        clearNavigatingNavLinks();
        link.classList.add('is-navigating');
        closeMobileToc();
        var sidebarFilterInput = document.getElementById('doc-sidebar-filter-input');
        if (sidebarFilterInput) { sidebarFilterInput.value = ''; filterSidebarNav(''); }
        navigate('docs/' + id);
    });
}

/* ── Sidebar filter events ────────────────────── */
var docSidebarFilterInput = document.getElementById('doc-sidebar-filter-input');
if (docSidebarFilterInput) {
    var sidebarFilterTimer = null;
    docSidebarFilterInput.addEventListener('input', function () {
        if (sidebarFilterTimer) clearTimeout(sidebarFilterTimer);
        sidebarFilterTimer = setTimeout(function () {
            filterSidebarNav(docSidebarFilterInput.value);
        }, 80);
    });
    docSidebarFilterInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            docSidebarFilterInput.value = '';
            filterSidebarNav('');
            docSidebarFilterInput.blur();
        }
    });
}

/* ── Interactive Demos (Event Delegation) ─────── */
document.addEventListener('click', function (e) {
    // Draggable: Programmatic Control Demo
    if (e.target.closest('#make-draggable-btn')) {
        var el = document.querySelector('#programmatic-element');
        if (el && window.VanduoDraggable) {
            VanduoDraggable.makeDraggable(el, { data: 'programmatic-item' });
            el.textContent = '✅ I am now draggable!';
        }
    }
    if (e.target.closest('#remove-draggable-btn')) {
        var el = document.querySelector('#programmatic-element');
        if (el && window.VanduoDraggable) {
            VanduoDraggable.removeDraggable(el);
            el.textContent = "I'm not draggable yet...";
        }
    }

        var waypointDemoButton = e.target.closest('[data-waypoint-demo-nav] button');
    if (waypointDemoButton) {
        var demoNav = waypointDemoButton.closest('[data-waypoint-demo-nav]');
        if (!demoNav) return;

        demoNav.querySelectorAll('button').forEach(function (button) {
            button.classList.toggle('is-active', button === waypointDemoButton);
            button.setAttribute('aria-selected', String(button === waypointDemoButton));
        });

        var demoPanel = demoNav.parentElement && demoNav.parentElement.querySelector('[data-waypoint-demo-panel]');
        var nextCopy = waypointDemoButton.getAttribute('data-waypoint-demo-copy');
        if (demoPanel && nextCopy) {
            demoPanel.textContent = nextCopy;
        }
    }

    // Theme Switcher Demo
    var themeSwitcherBtn = e.target.closest('.theme-switcher-demo-btn');
    if (themeSwitcherBtn) {
        var theme = themeSwitcherBtn.getAttribute('data-theme-value');
        if (theme) {
            applyTheme(theme);
            
            // Update active state on buttons
            var demoCard = themeSwitcherBtn.closest('.demo-card');
            if (demoCard) {
                demoCard.querySelectorAll('.theme-switcher-demo-btn').forEach(function(btn) {
                    btn.classList.toggle('active', btn === themeSwitcherBtn);
                });
            }
            
            // Update current theme label
            var currentThemeLabel = document.getElementById('demo-current-theme');
            if (currentThemeLabel) {
                currentThemeLabel.textContent = theme;
            }
        }
    }

    // Theme Customizer Demo - Color Mode
    var themeModeBtn = e.target.closest('.theme-mode-btn');
    if (themeModeBtn) {
        var mode = themeModeBtn.getAttribute('data-mode');
        if (mode) {
            applyTheme(mode);
            updateCustomizerDemoState();
        }
    }

    // Theme Customizer Demo - Primary Color
    var colorSwatch = e.target.closest('.color-swatch');
    if (colorSwatch) {
        var color = colorSwatch.getAttribute('data-color');
        if (color) {
            document.documentElement.setAttribute('data-primary', color);
            localStorage.setItem('vanduo-primary-color', color);
            updateCustomizerDemoState();
        }
    }

    // Theme Customizer Demo - Neutral Color
    var neutralBtn = e.target.closest('.neutral-btn');
    if (neutralBtn) {
        var neutral = neutralBtn.getAttribute('data-neutral');
        if (neutral) {
            document.documentElement.setAttribute('data-neutral', neutral);
            localStorage.setItem('vanduo-neutral-color', neutral);
            updateCustomizerDemoState();
        }
    }

    // Theme Customizer Demo - Border Radius
    var radiusBtn = e.target.closest('.radius-btn');
    if (radiusBtn) {
        var radius = radiusBtn.getAttribute('data-radius');
        if (radius) {
            document.documentElement.setAttribute('data-radius', radius);
            localStorage.setItem('vanduo-radius', radius);
            updateCustomizerDemoState();
        }
    }
});

// Apply theme using the real framework component behavior.
function applyTheme(theme) {
    var themeSwitcher = window.Vanduo
        && window.Vanduo.components
        && window.Vanduo.components.themeSwitcher;

    if (themeSwitcher && typeof themeSwitcher.setPreference === 'function') {
        themeSwitcher.setPreference(theme);
        return;
    }

    if (theme === 'system') {
        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('vanduo-theme-preference', theme);
}

var SUPPORTED_CUSTOMIZER_FONTS = {
    'jetbrains-mono': true,
    'system': true,
    'ubuntu': true,
    'lato': true,
    'open-sans': true
};

function normalizeCustomizerFontKey(fontKey) {
    var key = String(fontKey || '').trim().toLowerCase();
    if (!key) return 'ubuntu';
    if (Object.prototype.hasOwnProperty.call(SUPPORTED_CUSTOMIZER_FONTS, key)) {
        return key;
    }
    return 'ubuntu';
}

function applyCustomizerFontPreference(fontKey) {
    var normalized = normalizeCustomizerFontKey(fontKey);
    if (window.ThemeCustomizer && typeof window.ThemeCustomizer.applyFont === 'function') {
        window.ThemeCustomizer.applyFont(normalized);
        if (typeof window.ThemeCustomizer.updateUI === 'function') {
            window.ThemeCustomizer.updateUI();
        }
        return normalized;
    }

    if (normalized === 'system') {
        document.documentElement.removeAttribute('data-font');
    } else {
        document.documentElement.setAttribute('data-font', normalized);
    }
    localStorage.setItem('vanduo-font-preference', normalized);
    return normalized;
}

// Theme Customizer Demo - Font Family
var isFontSelectListenerInitialized = false;
function initFontSelectListener() {
    if (isFontSelectListenerInitialized) return;
    isFontSelectListenerInitialized = true;

    document.addEventListener('change', function (e) {
        var fontSelect = e.target && e.target.closest ? e.target.closest('.font-select') : null;
        if (!fontSelect) return;
        var normalizedFont = applyCustomizerFontPreference(fontSelect.value);
        fontSelect.value = normalizedFont;
        updateCustomizerDemoState();
    });
}

// Update visual state of customizer demo buttons
function updateCustomizerDemoState() {
    var html = document.documentElement;
    var theme = 'system';
    try {
        theme = localStorage.getItem('vanduo-theme-preference') || 'system';
    } catch (_e) {
        theme = 'system';
    }
    var primary = html.getAttribute('data-primary');
    if (!primary && window.ThemeCustomizer && typeof window.ThemeCustomizer.getDefaultPrimary === 'function') {
        var tm = (window.ThemeCustomizer.state && window.ThemeCustomizer.state.theme) ? window.ThemeCustomizer.state.theme : 'system';
        primary = window.ThemeCustomizer.getDefaultPrimary(tm);
    }
    if (!primary) {
        primary = 'black';
    }
    var neutral = html.getAttribute('data-neutral') || 'stone';
    var radius = html.getAttribute('data-radius') || '0.375';

    // Update mode buttons
    document.querySelectorAll('.theme-mode-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === theme);
    });

    // Update color swatches
    document.querySelectorAll('.color-swatch').forEach(function(swatch) {
        swatch.classList.toggle('active', swatch.getAttribute('data-color') === primary);
    });

    // Update neutral buttons
    document.querySelectorAll('.neutral-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-neutral') === neutral);
    });

    // Update radius buttons
    document.querySelectorAll('.radius-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-radius') === radius);
    });

    // Update font select
    var fontSelect = document.querySelector('.font-select');
    if (fontSelect) {
        var font = normalizeCustomizerFontKey(html.getAttribute('data-font') || localStorage.getItem('vanduo-font-preference') || 'ubuntu');
        fontSelect.value = font;
    }
}

var isCustomizerDemoBootstrapped = false;
function bootstrapCustomizerDemo() {
    if (isCustomizerDemoBootstrapped) return;
    isCustomizerDemoBootstrapped = true;
    initFontSelectListener();
    updateCustomizerDemoState();
}

// Initialize customizer demo regardless of dynamic script load timing.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapCustomizerDemo);
} else {
    bootstrapCustomizerDemo();
}

document.addEventListener('draggable:drop', function (e) {
    // Draggable: Drop Zone Demo
    if (e.target.id === 'demo-drop-zone') {
        e.target.appendChild(e.detail.element);
    }
});

wireRouteLinks(document.querySelector('.vd-footer'));

window.addEventListener('hashchange', function () {
    primeDocNavigationForHash(window.location.hash);
    handleRoute();
});
window.addEventListener('scroll', handleDocBoundaryScroll, { passive: true });
window.addEventListener('resize', requestActiveDocSectionUpdate);

/* ── Global Search ────────────────────────────── */
var globalSearchIndex = [];
var globalSearchState = {
    isOpen: false,
    results: [],
    activeIndex: -1,
    query: '',
    debounceTimer: null
};

function buildGlobalSearchIndex() {
    globalSearchIndex = [];

    // Index all doc tabs (components, concepts, guides)
    Object.keys(registry.tabs).forEach(function (tabKey) {
        var tab = registry.tabs[tabKey];
        tab.categories.forEach(function (cat) {
            cat.sections.forEach(function (sec) {
                globalSearchIndex.push({
                    id: sec.id,
                    title: sec.title,
                    category: cat.name,
                    tab: tab.label,
                    keywords: (sec.keywords || []).join(' '),
                    icon: sec.icon || 'ph-file-text',
                    route: 'docs/' + sec.id
                });
            });
        });
    });

    // Index pages
    globalSearchIndex.push({
        id: 'home',
        title: 'Home',
        category: 'Pages',
        tab: 'Pages',
        keywords: 'home landing features overview framework vanduo',
        icon: 'ph-house',
        route: 'home'
    });
    globalSearchIndex.push({
        id: 'about',
        title: 'About',
        category: 'Pages',
        tab: 'Pages',
        keywords: 'about mission founders team open source story water shape',
        icon: 'ph-info',
        route: 'about'
    });
    globalSearchIndex.push({
        id: 'changelog',
        title: 'Changelog',
        category: 'Pages',
        tab: 'Pages',
        keywords: 'changelog versions releases updates history changes new features',
        icon: 'ph-clock-counter-clockwise',
        route: 'changelog'
    });
    globalSearchIndex.push({
        id: 'docs-landing',
        title: 'Docs',
        category: 'Pages',
        tab: 'Pages',
        keywords: 'documentation doc docs components guides',
        icon: 'ph-book-open',
        route: 'docs'
    });
    globalSearchIndex.push({
        id: 'kilo-oss',
        title: 'Kilo OSS',
        category: 'Pages',
        tab: 'Pages',
        keywords: 'kilo oss sponsorship open source story vanduo',
        icon: 'ph-heart',
        route: 'kilo-oss'
    });
}

function globalSearch(query) {
    var terms = query.toLowerCase().split(/\s+/).filter(function (t) { return t.length > 0; });
    if (terms.length === 0) return [];
    var scored = [];
    globalSearchIndex.forEach(function (entry) {
        var score = 0;
        var titleLower = entry.title.toLowerCase();
        var catLower = entry.category.toLowerCase();
        var kwLower = entry.keywords.toLowerCase();

        terms.forEach(function (term) {
            if (titleLower.includes(term)) {
                score += 100;
                if (titleLower === term) score += 50;
                else if (titleLower.startsWith(term)) score += 25;
            }
            if (catLower.includes(term)) score += 50;
            if (kwLower.includes(term)) score += 30;
        });

        // Slight boost for page entries so they surface when searched directly
        if (entry.category === 'Pages' && score > 0) score += 5;

        if (score > 0) {
            scored.push(Object.assign({ score: score }, entry));
        }
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 15);
}

function globalSearchEscapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function globalSearchHighlight(text, query) {
    if (!query) return globalSearchEscapeHtml(text);
    var terms = query.toLowerCase().split(/\s+/).filter(function (t) { return t.length > 0; });
    var escaped = globalSearchEscapeHtml(text);
    terms.forEach(function (term) {
        if (term.length > 50) return;
        var regex = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        escaped = escaped.replace(regex, '<mark>$1</mark>');
    });
    return escaped;
}

function renderGlobalSearchResults() {
    var container = document.getElementById('global-search-results');
    if (globalSearchState.results.length === 0 && globalSearchState.query.length >= 2) {
        container.innerHTML = '<div class="global-search-empty">'
            + '<div class="global-search-empty-icon"><i class="ph ph-magnifying-glass"></i></div>'
            + '<div class="global-search-empty-title">No results found</div>'
            + '<div class="global-search-empty-text">Try different keywords or check spelling</div></div>';
        return;
    }
    if (globalSearchState.results.length === 0) {
        container.innerHTML = '<div class="global-search-hint">'
            + '<div class="global-search-hint-icon"><i class="ph ph-magnifying-glass"></i></div>'
            + '<div class="global-search-hint-text">Type to search across all documentation, guides, and pages</div></div>';
        return;
    }

    // Group results by tab/category
    var html = '<ul class="global-search-results-list" role="listbox">';
    var lastCategory = '';
    var flatIndex = 0;
    globalSearchState.results.forEach(function (r) {
        var groupLabel = r.tab + ' › ' + r.category;
        if (groupLabel !== lastCategory) {
            html += '<li class="global-search-category-label">' + globalSearchEscapeHtml(groupLabel) + '</li>';
            lastCategory = groupLabel;
        }
        var isActive = flatIndex === globalSearchState.activeIndex;
        html += '<li class="global-search-result' + (isActive ? ' is-active' : '') + '"'
            + ' role="option" data-index="' + flatIndex + '"'
            + ' data-route="' + globalSearchEscapeHtml(r.route) + '"'
            + ' aria-selected="' + isActive + '">'
            + '<div class="global-search-result-icon"><i class="ph ' + globalSearchEscapeHtml(r.icon) + '"></i></div>'
            + '<div class="global-search-result-content">'
            + '<div class="global-search-result-title">' + globalSearchHighlight(r.title, globalSearchState.query) + '</div>'
            + '<div class="global-search-result-meta">' + globalSearchEscapeHtml(r.category) + '</div>'
            + '</div></li>';
        flatIndex++;
    });
    html += '</ul>';
    container.innerHTML = html;
}

function openGlobalSearch() {
    if (globalSearchState.isOpen) return;
    globalSearchState.isOpen = true;
    document.getElementById('global-search-overlay').classList.add('is-open');
    document.getElementById('global-search-modal').classList.add('is-open');
    var input = document.getElementById('global-search-input');
    input.value = '';
    globalSearchState.query = '';
    globalSearchState.results = [];
    globalSearchState.activeIndex = -1;
    renderGlobalSearchResults();
    setTimeout(function () { input.focus(); }, 50);
    document.body.style.overflow = 'hidden';
}

function closeGlobalSearch() {
    if (!globalSearchState.isOpen) return;
    globalSearchState.isOpen = false;
    document.getElementById('global-search-overlay').classList.remove('is-open');
    document.getElementById('global-search-modal').classList.remove('is-open');
    document.body.style.overflow = '';
}

function selectGlobalSearchResult(index) {
    var result = globalSearchState.results[index];
    if (!result) return;
    closeGlobalSearch();
    navigate(result.route, { showScrollLoader: true });
}

function setGlobalSearchActiveIndex(index) {
    var container = document.getElementById('global-search-results');
    var prev = container.querySelector('.global-search-result.is-active');
    if (prev) {
        prev.classList.remove('is-active');
        prev.setAttribute('aria-selected', 'false');
    }
    globalSearchState.activeIndex = index;
    var next = container.querySelector('[data-index="' + index + '"]');
    if (next) {
        next.classList.add('is-active');
        next.setAttribute('aria-selected', 'true');
        next.scrollIntoView({ block: 'nearest' });
    }
}

function initGlobalSearch() {
    buildGlobalSearchIndex();

    // Navbar trigger
    var trigger = document.getElementById('global-search-trigger');
    if (trigger) {
        trigger.addEventListener('click', function () { openGlobalSearch(); });
    }

    // Overlay click
    document.getElementById('global-search-overlay').addEventListener('click', function () {
        closeGlobalSearch();
    });

    // Input handler
    var input = document.getElementById('global-search-input');
    input.addEventListener('input', function () {
        if (globalSearchState.debounceTimer) clearTimeout(globalSearchState.debounceTimer);
        globalSearchState.debounceTimer = setTimeout(function () {
            globalSearchState.query = input.value.trim();
            if (globalSearchState.query.length < 2) {
                globalSearchState.results = [];
                globalSearchState.activeIndex = -1;
                renderGlobalSearchResults();
                return;
            }
            globalSearchState.results = globalSearch(globalSearchState.query);
            globalSearchState.activeIndex = -1;
            renderGlobalSearchResults();
        }, 120);
    });

    // Keyboard navigation inside modal
    input.addEventListener('keydown', function (e) {
        if (!globalSearchState.isOpen) return;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                var nextDown = globalSearchState.activeIndex + 1;
                if (nextDown >= globalSearchState.results.length) nextDown = 0;
                setGlobalSearchActiveIndex(nextDown);
                break;
            case 'ArrowUp':
                e.preventDefault();
                var nextUp = globalSearchState.activeIndex - 1;
                if (nextUp < 0) nextUp = globalSearchState.results.length - 1;
                setGlobalSearchActiveIndex(nextUp);
                break;
            case 'Enter':
                e.preventDefault();
                if (globalSearchState.activeIndex >= 0) {
                    selectGlobalSearchResult(globalSearchState.activeIndex);
                } else if (globalSearchState.results.length > 0) {
                    selectGlobalSearchResult(0);
                }
                break;
            case 'Escape':
                e.preventDefault();
                closeGlobalSearch();
                break;
        }
    });

    // Result click
    document.getElementById('global-search-results').addEventListener('click', function (e) {
        var item = e.target.closest('.global-search-result');
        if (item) {
            var idx = parseInt(item.dataset.index, 10);
            selectGlobalSearchResult(idx);
        }
    });

    // Cmd/Ctrl+K global shortcut
    document.addEventListener('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            e.stopPropagation();

            var heroInput = document.getElementById('hero-search-input');
            // If on home page and hero search exists + is visible
            if (heroInput && heroInput.offsetParent !== null) {
                heroInput.focus();
                return;
            }

            if (globalSearchState.isOpen) {
                closeGlobalSearch();
            } else {
                openGlobalSearch();
            }
        }
    }, true);

    // ── Hero inline search dropdown ──────────────────
    var heroSearchState = {
        isOpen: false,
        results: [],
        activeIndex: -1,
        query: '',
        debounceTimer: null
    };

    function openHeroDropdown() {
        var dropdown = document.getElementById('hero-search-dropdown');
        if (!dropdown) return;
        heroSearchState.isOpen = true;
        dropdown.classList.add('is-open');
    }

    function closeHeroDropdown() {
        var dropdown = document.getElementById('hero-search-dropdown');
        if (!dropdown) return;
        heroSearchState.isOpen = false;
        heroSearchState.activeIndex = -1;
        dropdown.classList.remove('is-open');
    }

    function renderHeroDropdownResults() {
        var dropdown = document.getElementById('hero-search-dropdown');
        if (!dropdown) return;

        // Empty → show no-results
        if (heroSearchState.results.length === 0 && heroSearchState.query.length >= 2) {
            dropdown.innerHTML = '<div class="hero-dropdown-hint">'
                + '<div class="hero-dropdown-hint-icon"><i class="ph ph-magnifying-glass"></i></div>'
                + '<div class="hero-dropdown-hint-text">No results found</div></div>';
            return;
        }

        // No query yet → initial hint
        if (heroSearchState.results.length === 0) {
            dropdown.innerHTML = '<div class="hero-dropdown-hint">'
                + '<div class="hero-dropdown-hint-icon"><i class="ph ph-magnifying-glass"></i></div>'
                + '<div class="hero-dropdown-hint-text">Type to search documentation, components & guides</div></div>';
            return;
        }

        // Build results list (reusing same markup as modal)
        var html = '<ul class="global-search-results-list" role="listbox">';
        var lastCategory = '';
        var flatIndex = 0;
        heroSearchState.results.forEach(function (r) {
            var groupLabel = r.tab + ' › ' + r.category;
            if (groupLabel !== lastCategory) {
                html += '<li class="global-search-category-label">' + globalSearchEscapeHtml(groupLabel) + '</li>';
                lastCategory = groupLabel;
            }
            var isActive = flatIndex === heroSearchState.activeIndex;
            html += '<li class="global-search-result' + (isActive ? ' is-active' : '') + '"'
                + ' role="option" data-hero-index="' + flatIndex + '"'
                + ' data-route="' + globalSearchEscapeHtml(r.route) + '"'
                + ' aria-selected="' + isActive + '">'
                + '<div class="global-search-result-icon"><i class="ph ' + globalSearchEscapeHtml(r.icon) + '"></i></div>'
                + '<div class="global-search-result-content">'
                + '<div class="global-search-result-title">' + globalSearchHighlight(r.title, heroSearchState.query) + '</div>'
                + '<div class="global-search-result-meta">' + globalSearchEscapeHtml(r.category) + '</div>'
                + '</div></li>';
            flatIndex++;
        });
        html += '</ul>';
        html += '<div class="hero-search-dropdown-footer">'
            + '<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>'
            + '<span><kbd>↵</kbd> select</span>'
            + '<span><kbd>esc</kbd> close</span>'
            + '</div>';
        dropdown.innerHTML = html;
    }

    function setHeroActiveIndex(index) {
        var dropdown = document.getElementById('hero-search-dropdown');
        if (!dropdown) return;
        var prev = dropdown.querySelector('.global-search-result.is-active');
        if (prev) {
            prev.classList.remove('is-active');
            prev.setAttribute('aria-selected', 'false');
        }
        heroSearchState.activeIndex = index;
        var next = dropdown.querySelector('[data-hero-index="' + index + '"]');
        if (next) {
            next.classList.add('is-active');
            next.setAttribute('aria-selected', 'true');
            next.scrollIntoView({ block: 'nearest' });
        }
    }

    function selectHeroResult(index) {
        var result = heroSearchState.results[index];
        if (!result) return;
        closeHeroDropdown();
        var input = document.getElementById('hero-search-input');
        if (input) { input.value = ''; input.blur(); }
        heroSearchState.query = '';
        heroSearchState.results = [];
        heroSearchState.activeIndex = -1;
        navigate(result.route, { showScrollLoader: true });
    }

    // Event delegation for hero search (home.html loads dynamically)
    document.addEventListener('input', function (e) {
        if (!e.target || e.target.id !== 'hero-search-input') return;
        if (heroSearchState.debounceTimer) clearTimeout(heroSearchState.debounceTimer);
        heroSearchState.debounceTimer = setTimeout(function () {
            heroSearchState.query = e.target.value.trim();
            if (heroSearchState.query.length < 2) {
                heroSearchState.results = [];
                heroSearchState.activeIndex = -1;
                renderHeroDropdownResults();
                return;
            }
            heroSearchState.results = globalSearch(heroSearchState.query);
            heroSearchState.activeIndex = -1;
            renderHeroDropdownResults();
        }, 120);
    });

    // Focus → open dropdown with hint
    document.addEventListener('focusin', function (e) {
        if (!e.target || e.target.id !== 'hero-search-input') return;
        renderHeroDropdownResults();
        openHeroDropdown();
    });

    // Keyboard nav inside hero search
    document.addEventListener('keydown', function (e) {
        if (!e.target || e.target.id !== 'hero-search-input') return;
        if (!heroSearchState.isOpen) return;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                var nextDown = heroSearchState.activeIndex + 1;
                if (nextDown >= heroSearchState.results.length) nextDown = 0;
                setHeroActiveIndex(nextDown);
                break;
            case 'ArrowUp':
                e.preventDefault();
                var nextUp = heroSearchState.activeIndex - 1;
                if (nextUp < 0) nextUp = heroSearchState.results.length - 1;
                setHeroActiveIndex(nextUp);
                break;
            case 'Enter':
                e.preventDefault();
                if (heroSearchState.activeIndex >= 0) {
                    selectHeroResult(heroSearchState.activeIndex);
                } else if (heroSearchState.results.length > 0) {
                    selectHeroResult(0);
                }
                break;
            case 'Escape':
                e.preventDefault();
                closeHeroDropdown();
                e.target.blur();
                break;
        }
    });

    // Click result in dropdown
    document.addEventListener('click', function (e) {
        var item = e.target.closest('[data-hero-index]');
        if (item && item.closest('.hero-search-dropdown')) {
            var idx = parseInt(item.dataset.heroIndex, 10);
            selectHeroResult(idx);
            return;
        }
        // Click outside → close dropdown
        if (heroSearchState.isOpen && !e.target.closest('.hero-search-wrapper')) {
            closeHeroDropdown();
        }
    });
}

/* ── Dark Mode Toggle Icon Sync ───────────────── */
(function () {
    var toggle = document.getElementById('dark-mode-toggle');
    if (!toggle) return;
    var icon = toggle.querySelector('i');
    if (!icon) return;

    function updateIcon() {
        var pref = 'system';
        try {
            pref = localStorage.getItem('vanduo-theme-preference') || 'system';
        } catch (e) { }

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

    // Watch for data-theme attribute changes (set by framework ThemeSwitcher)
    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            if (m.attributeName === 'data-theme') updateIcon();
        });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();

/* ── Init ───────────────────────────────────── */
(async function () {
    primeDocNavigationForHash(window.location.hash);
    await loadRegistry();
    initGlobalSearch();

    // Dynamic component count badge (docs landing)
    var totalSections = 0;
    Object.keys(registry.tabs).forEach(function (tabKey) {
        registry.tabs[tabKey].categories.forEach(function (cat) {
            totalSections += cat.sections.length;
        });
    });
    var countEl = document.getElementById('docs-component-count-num');
    if (countEl) countEl.textContent = totalSections + '+';

    // Copy Class Name micro-interaction
    document.body.addEventListener('click', function (e) {
        var target = e.target;
        if (target.tagName === 'CODE' && target.closest('.vd-table') || target.classList.contains('code-selector') && target.closest('.vd-code-snippet')) {
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

    await handleRoute();

    if ('serviceWorker' in navigator) {
        var isLocalPreview = window.location.protocol === 'file:'
            || window.location.hostname === 'localhost'
            || window.location.hostname === '127.0.0.1';
        if (!isLocalPreview) {
            navigator.serviceWorker.register('./sw.js').catch(function (err) {
                console.warn('Service worker registration failed', err);
            });
        }
    }
})();
