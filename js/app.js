if (typeof window.Vanduo === 'undefined') {
    console.error('Vanduo failed to load from CDN. Check network/CDN availability.');
} else {
    // Extend theme customizer with site-specific fonts and override defaults
    if (window.ThemeCustomizer) {
        Object.assign(window.ThemeCustomizer.FONT_OPTIONS, {
            'google-sans': { name: 'Google Sans', family: "'Google Sans', sans-serif" },
            'roboto': { name: 'Roboto', family: "'Roboto', sans-serif" },
            'lato': { name: 'Lato', family: "'Lato', sans-serif" },
            'noto-sans': { name: 'Noto Sans', family: "'Noto Sans', sans-serif" }
        });
        Object.assign(window.ThemeCustomizer.DEFAULTS, {
            FONT: 'lato',
            PRIMARY_LIGHT: 'black',
            PRIMARY_DARK: 'amber',
            NEUTRAL: 'slate',
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

/* ── Constants ────────────────────────────────── */
const SECTIONS_BASE = './sections/';
let registry = { pages: [], tabs: {} };
const loadedSections = new Set();
const loadingSections = new Set();
let scrollSpyObserver = null;
let docLazyLoader = null;
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
const SECTION_PRELOAD_CONCURRENCY = 6;
const sectionPrefetching = new Set();
let docsWarmupTimer = null;

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

function requestDocScrollLoaderForRoute(route) {
    if (typeof route !== 'string' || !route.startsWith('docs/')) {
        requestedDocScrollLoaderSectionId = null;
        return;
    }
    var parsed = parseHash('#' + route);
    requestedDocScrollLoaderSectionId = parsed && parsed.section ? parsed.section : null;
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
function getLoadingPlaceholderHtml() {
    return '<div style="padding: 4rem 0; scroll-margin-top: 80px; border-bottom: 1px solid var(--border-color);">'
        + '<div class="vd-skeleton-card" style="position: relative; min-height: 300px; padding: 2rem; overflow: hidden;">'
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
        + '<div class="vd-dynamic-loader-grid">'
        + '<div class="vd-spinner vd-spinner-sm vd-spinner-success" style="animation-delay: 0s;"></div>'
        + '<div class="vd-spinner vd-spinner-sm vd-spinner-warning" style="animation-delay: -0.15s;"></div>'
        + '<div class="vd-spinner vd-spinner-sm vd-spinner-error" style="animation-delay: -0.3s;"></div>'
        + '<div class="vd-spinner vd-spinner-sm vd-spinner-info" style="animation-delay: -0.45s;"></div></div>'
        + '<span class="vd-dynamic-loader-text">Loading section...</span></div></div></div>';
}

function getPagePlaceholderHtml() {
    return '<div style="min-height: 60vh; display: flex; align-items: center; justify-content: center;">'
        + '<div class="vd-dynamic-loader">'
        + '<div class="vd-dynamic-loader-grid">'
        + '<div class="vd-spinner vd-spinner-sm vd-spinner-success" style="animation-delay: 0s;"></div>'
        + '<div class="vd-spinner vd-spinner-sm vd-spinner-warning" style="animation-delay: -0.15s;"></div>'
        + '<div class="vd-spinner vd-spinner-sm vd-spinner-error" style="animation-delay: -0.3s;"></div>'
        + '<div class="vd-spinner vd-spinner-sm vd-spinner-info" style="animation-delay: -0.45s;"></div></div>'
        + '<span class="vd-dynamic-loader-text">Loading...</span></div></div>';
}

function getDocScrollLoaderHtml() {
    return '<div class="vd-skeleton-card" style="position: relative; min-height: 220px; padding: 1.5rem; overflow: hidden;">'
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
        + '<div class="vd-dynamic-loader-grid">'
        + '<div class="vd-spinner vd-spinner-sm vd-spinner-success" style="animation-delay: 0s;"></div>'
        + '<div class="vd-spinner vd-spinner-sm vd-spinner-warning" style="animation-delay: -0.15s;"></div>'
        + '<div class="vd-spinner vd-spinner-sm vd-spinner-error" style="animation-delay: -0.3s;"></div>'
        + '<div class="vd-spinner vd-spinner-sm vd-spinner-info" style="animation-delay: -0.45s;"></div></div>'
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
    if (!docScrollLoaderEl || !sectionId || docScrollLoaderTargetId !== sectionId) return;

    var deadline = Date.now() + 3200;
    function checkScrollCompletion() {
        if (!docScrollLoaderEl || docScrollLoaderTargetId !== sectionId) return;
        var target = document.getElementById(sectionId);
        if (!target) {
            if (Date.now() >= deadline) {
                hideDocScrollLoader();
            } else {
                window.requestAnimationFrame(checkScrollCompletion);
            }
            return;
        }

        var targetTop = target.getBoundingClientRect().top;
        var driftedDown = targetTop > (SCROLL_SPY_OFFSET + 32);
        if (driftedDown) {
            target.scrollIntoView({ behavior: 'auto', block: 'start' });
            targetTop = target.getBoundingClientRect().top;
        }
        var reachedTarget = targetTop <= (SCROLL_SPY_OFFSET + 10);
        if (reachedTarget || Date.now() >= deadline) {
            hideDocScrollLoader();
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
    return parsed && parsed.section ? parsed.section : null;
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
        var res = await fetch(SECTIONS_BASE + meta.section.file, { signal: options.signal });
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
    var res = await fetch(SECTIONS_BASE + 'sections.json');
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

function _setToggleContent(el, tabKey) {
    var isGuides = tabKey === 'guides';
    var icon = el.querySelector('.doc-water-icon');
    var label = el.querySelector('.doc-water-label');
    if (icon) icon.className = isGuides ? 'doc-water-icon ph ph-compass' : 'doc-water-icon ph ph-cube';
    if (label) label.textContent = isGuides ? 'Guides' : 'Components';
}

function setActiveDocMode(tabKey) {
    var toggle = document.getElementById('doc-water-toggle');
    if (!toggle) return;

    var isGuides = tabKey === 'guides';
    toggle.setAttribute('aria-pressed', String(isGuides));
    toggle.setAttribute('aria-label', isGuides ? 'Switch to Components' : 'Switch to Guides');

    if (_toggleMorphing) return;

    var current = toggle.querySelector('.vd-morph-current');
    var next = toggle.querySelector('.vd-morph-next');
    var oppositeTab = isGuides ? 'components' : 'guides';
    if (current) _setToggleContent(current, tabKey);
    if (next) _setToggleContent(next, oppositeTab);
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

/* ── View switching ───────────────────────────── */
function showView(view) {
    var pageView = document.getElementById('page-view');
    var docsView = document.getElementById('docs-view');
    if (view === 'docs') {
        pageView.classList.remove('is-active');
        docsView.classList.add('is-active');
    } else {
        docsView.classList.remove('is-active');
        pageView.classList.add('is-active');
    }
    currentView = view;
}

/* ── Page loading (Home / About / Changelog) ── */
async function loadPage(pageId) {
    hideDocScrollLoader();
    if (currentView === pageId && document.getElementById(pageId)) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    showView(pageId);
    setActiveNavbarLink(pageId);
    var container = document.getElementById('page-view');

    container.innerHTML = getPagePlaceholderHtml();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    var page = findPageMeta(pageId);
    if (!page) {
        container.innerHTML = '<div class="vd-alert vd-alert-error" style="margin: 2rem;">Page not found.</div>';
        return;
    }
    try {
        setDocumentTitle(page.title);
        var res = await fetch(SECTIONS_BASE + page.file);
        if (!res.ok) throw new Error('Failed to load ' + page.file);
        var html = await res.text();
        container.innerHTML = html.trim();
        if (typeof Vanduo !== 'undefined') Vanduo.init();
        hideDisabledCodeTabs(container);
        wireRouteLinks(container);
        initChangelogPagination(pageId, container);
        initHexGridDemo();
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="vd-alert vd-alert-error" style="margin: 2rem;">Failed to load page. Check console.</div>';
    }
}

/* ── Section loading (docs) ───────────────────── */
async function preloadSectionsBefore(tabKey, targetSectionId, options = {}) {
    var signal = options.signal;
    var orderedIds = getOrderedIds(tabKey);
    var targetIndex = orderedIds.indexOf(targetSectionId);
    if (targetIndex <= 0) return;

    var pendingIds = [];
    for (var i = 0; i < targetIndex; i++) {
        var id = orderedIds[i];
        if (!loadedSections.has(id) && !loadingSections.has(id)) {
            pendingIds.push(id);
        }
    }

    if (!pendingIds.length) {
        setupInfiniteScroll();
        return;
    }

    var cursor = 0;
    var workerCount = Math.min(SECTION_PRELOAD_CONCURRENCY, pendingIds.length);
    async function worker() {
        while (cursor < pendingIds.length) {
            if (signal && signal.aborted) return;
            var id = pendingIds[cursor];
            cursor += 1;
            await loadSection(id, false, { signal: signal, skipInfiniteRefresh: true });
        }
    }

    await Promise.all(Array.from({ length: workerCount }, worker));
    setupInfiniteScroll();
}

async function loadSection(sectionId, autoScroll = true, options = {}) {
    var signal = options.signal;
    var skipInfiniteRefresh = options.skipInfiniteRefresh === true;
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
        if (el && autoScroll) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (autoScroll) settleDocScrollLoader(sectionId);
        setActiveNavLink(sectionId);
        if (autoScroll) releasePendingDocNavigation(450);
        return;
    }

    var meta = findSectionMeta(sectionId);
    if (!meta) {
        return;
    }

    if (autoScroll) {
        await preloadSectionsBefore(meta.tab, sectionId, { signal: signal });
        if (signal && signal.aborted) return;
        if (loadedSections.has(sectionId)) {
            var existingSection = document.getElementById(sectionId);
            if (existingSection) existingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            settleDocScrollLoader(sectionId);
            setActiveNavLink(sectionId);
            setDocumentTitle(meta.section.title);
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', '#docs/' + sectionId);
            }
            activeDocSectionId = sectionId;
            releasePendingDocNavigation(450);
            return;
        }
    }

    if (loadingSections.has(sectionId)) {
        return;
    }
    loadingSections.add(sectionId);

    var container = document.getElementById('dynamic-content');
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
            var res = await fetch(url, { signal: signal });
            if (!res.ok) throw new Error('Failed to load ' + url);
            html = await res.text();
            setCachedSectionHtml(sectionId, html);
        }
        var wrap = document.createElement('div');
        wrap.innerHTML = html.trim();
        var sectionEl = wrap.firstElementChild;
        if (sectionEl) {
            if (document.startViewTransition && autoScroll) {
                await document.startViewTransition(function () {
                    container.replaceChild(sectionEl, placeholder);
                }).finished;
            } else {
                container.replaceChild(sectionEl, placeholder);
            }
            loadedSections.add(sectionId);
            if (typeof Vanduo !== 'undefined') Vanduo.init();
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
        if (target && autoScroll) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (autoScroll) settleDocScrollLoader(sectionId);

        if (autoScroll) {
            setActiveNavLink(sectionId);
            setDocumentTitle(meta.section.title);
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', '#docs/' + sectionId);
            }
            activeDocSectionId = sectionId;
            releasePendingDocNavigation(450);
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

    var container = document.getElementById('dynamic-content');
    container.innerHTML = '';
    loadedSections.clear();
    loadingSections.clear();
    if (docLazyLoader) {
        docLazyLoader.disconnect();
    }
    if (scrollSpyObserver) {
        scrollSpyObserver.disconnect();
        scrollSpyObserver = null;
    }
    scrollSpyTicking = false;
    activeDocSectionId = null;

    buildSidebar(tabKey);
    closeMobileToc();

    var orderedIds = getOrderedIds(tabKey);
    if (orderedIds.length > 0) {
        await loadSection(orderedIds[0], true, { signal: signal });
    }
    if (signal && signal.aborted) return;
    scheduleDocsWarmup(tabKey);
}

/* ── Scroll-spy ───────────────────────────────── */
const SCROLL_SPY_OFFSET = 96;

function syncActiveDocSection(sectionId) {
    if (!sectionId) return;
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

        if (sectionEl.getBoundingClientRect().top <= SCROLL_SPY_OFFSET) {
            activeId = id;
            continue;
        }

        break;
    }

    return activeId || firstLoadedId;
}

function updateActiveDocSection() {
    scrollSpyTicking = false;
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
    var container = document.getElementById('dynamic-content');
    if (!container) return;

    if (!window.VanduoLazyLoader) return; // Safety check if module not loaded

    if (!docLazyLoader) {
        docLazyLoader = new window.VanduoLazyLoader({
            container: container,
            onLoadNext: loadNextSection,
            rootMargin: '400px'
        });
    }

    // Always re-init when needed to append sentinel to the bottom again
    docLazyLoader.init();
}

function loadNextSection() {
    if (!currentTab) return;
    var orderedIds = getOrderedIds(currentTab);

    // Find the highest index among currently loaded or loading sections
    var maxIndex = -1;
    for (var id of orderedIds) {
        if (loadedSections.has(id) || loadingSections.has(id)) {
            var idx = orderedIds.indexOf(id);
            if (idx > maxIndex) {
                maxIndex = idx;
            }
        }
    }

    var nextIndex = maxIndex + 1;
    if (nextIndex < orderedIds.length) {
        loadSection(orderedIds[nextIndex], false, { skipInfiniteRefresh: true }) // autoScroll = false
            .finally(function () {
                setupInfiniteScroll();
            });
    }
}

function scheduleDocsWarmup(tabKey) {
    if (!tabKey) return;
    if (docsWarmupTimer) {
        clearTimeout(docsWarmupTimer);
        docsWarmupTimer = null;
    }

    var runWarmup = function () {
        getOrderedIds(tabKey).forEach(function (id) {
            prefetchSection(id);
        });
    };

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(runWarmup, { timeout: 1500 });
    } else {
        docsWarmupTimer = setTimeout(runWarmup, 500);
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

function initHexGridDemo() {
    var demoContainer = document.getElementById('hex-demo-container');
    var demoCanvas = document.getElementById('hex-demo');
    
    if (!demoContainer || !demoCanvas) return;

    // Destroy any previous instance to disconnect its MutationObserver
    if (_hexGridInstance) {
        _hexGridInstance.destroy();
        _hexGridInstance = null;
    }
    
    // Dynamic import to avoid loading on other pages
    import('./hex-grid.js').then(function(module) {
        var VdHexGrid = module.VdHexGrid;
        var sizeSlider = document.getElementById('hex-size-slider');
        var widthSlider = document.getElementById('hex-width-slider');
        var heightSlider = document.getElementById('hex-height-slider');
        var rotationSlider = document.getElementById('hex-rotation-slider');
        
        var grid = new VdHexGrid({
            element: demoContainer,
            canvas: demoCanvas,
            size: parseInt(sizeSlider?.value || '30'),
            width: parseInt(widthSlider?.value || '15'),
            height: parseInt(heightSlider?.value || '10')
        });
        _hexGridInstance = grid;
        
        // Wire up controls
        var sizeValue = document.getElementById('hex-size-value');
        var widthValue = document.getElementById('hex-width-value');
        var heightValue = document.getElementById('hex-height-value');
        var rotationValue = document.getElementById('hex-rotation-value');
        var resetBtn = document.getElementById('hex-reset-btn');
        var fillBtn = document.getElementById('hex-fill-btn');
        var infoCard = document.getElementById('hex-info-card');
        
        // Toolbar buttons
        var zoomInBtn = document.getElementById('hex-zoom-in');
        var zoomOutBtn = document.getElementById('hex-zoom-out');
        var resetViewBtn = document.getElementById('hex-reset-view');
        var zoomLevelSpan = document.getElementById('hex-zoom-level');
        
        if (sizeSlider && sizeValue) {
            sizeSlider.addEventListener('input', function(e) {
                sizeValue.textContent = e.target.value + 'px';
                grid.setSize(parseInt(e.target.value));
            });
        }
        
        if (widthSlider && widthValue) {
            widthSlider.addEventListener('input', function(e) {
                widthValue.textContent = e.target.value;
                grid.setDimensions(parseInt(e.target.value), grid.height);
            });
        }
        
        if (heightSlider && heightValue) {
            heightSlider.addEventListener('input', function(e) {
                heightValue.textContent = e.target.value;
                grid.setDimensions(grid.width, parseInt(e.target.value));
            });
        }
        
        if (rotationSlider && rotationValue) {
            rotationSlider.addEventListener('input', function(e) {
                var deg = parseInt(e.target.value, 10);
                rotationValue.textContent = deg + '\u00b0';
                grid.setRotation(deg * Math.PI / 180);
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                if (sizeSlider) sizeSlider.value = 30;
                if (widthSlider) widthSlider.value = 15;
                if (heightSlider) heightSlider.value = 10;
                if (rotationSlider) rotationSlider.value = '0';
                if (sizeValue) sizeValue.textContent = '30px';
                if (widthValue) widthValue.textContent = '15';
                if (heightValue) heightValue.textContent = '10';
                if (rotationValue) rotationValue.textContent = '0\u00b0';
                grid.reset();
            });
        }
        
        if (fillBtn) {
            fillBtn.addEventListener('click', function() {
                grid.fillRandom();
            });
        }
        
        // Toolbar button handlers
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', function() {
                grid.zoomIn();
            });
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', function() {
                grid.zoomOut();
            });
        }
        
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', function() {
                grid.resetView();
            });
        }
        
        // Listen for zoom events to update zoom level indicator
        grid.on('zoom', function(data) {
            if (zoomLevelSpan) {
                var percent = Math.round(data.scale * 100);
                zoomLevelSpan.textContent = percent + '%';
            }
        });
        
        // Listen for selection events
        grid.on('select', function(hex) {
            if (infoCard) infoCard.style.display = 'block';
            var coords = document.getElementById('hex-coords');
            var pixelX = document.getElementById('hex-pixel-x');
            var pixelY = document.getElementById('hex-pixel-y');
            var adjacent = document.getElementById('hex-adjacent');
            
            if (coords) coords.textContent = '(' + hex.q + ', ' + hex.r + ')';
            if (pixelX) pixelX.textContent = Math.round(hex.x);
            if (pixelY) pixelY.textContent = Math.round(hex.y);
            if (adjacent) adjacent.textContent = hex.adjacent?.length || 0;
        });
    }).catch(function(err) {
        console.error('Failed to load VdHexGrid:', err);
    });
}

/* ── Router ───────────────────────────────────── */
function parseHash(hash) {
    var h = (hash || '').replace(/^#\/?/, '');
    if (!h || h === 'home') return { view: 'home' };
    if (h === 'about') return { view: 'about' };
    if (h === 'changelog') return { view: 'changelog' };
    if (h === 'kilo-oss') return { view: 'kilo-oss' };
    if (h === 'docs') return { view: 'docs-landing' };
    if (h === 'labs') return { view: 'labs' };
    if (h === 'docs/components') return { view: 'docs', tab: 'components', section: null };
    if (h === 'docs/guides') return { view: 'docs', tab: 'guides', section: null };
    if (h.startsWith('docs/')) {
        var fullPath = h.slice(5);
        var sectionId = fullPath.split('#')[0];
        var tabKey = getTabForSection(sectionId);
        if (tabKey) return { view: 'docs', tab: tabKey, section: sectionId };
        return { view: 'docs', tab: 'components', section: null };
    }
    return { view: 'home' };
}

async function navigate(route) {
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

    if (parsed.view === 'home' || parsed.view === 'about' || parsed.view === 'changelog' || parsed.view === 'kilo-oss' || parsed.view === 'docs-landing' || parsed.view === 'labs') {
        await loadPage(parsed.view);
        if (parsed.view === 'docs-landing') {
            setActiveNavbarLink('docs');
        }
        if (parsed.view === 'labs') {
            setActiveNavbarLink('labs');
        }
        return;
    }

    showView('docs');
    setActiveNavbarLink('docs');

    if (currentTab !== parsed.tab) {
        await switchTab(parsed.tab, { signal: signal });
        if (signal.aborted) return;
    }

    if (parsed.section) {
        await loadSection(parsed.section, true, { signal: signal });
        if (!signal.aborted) {
            scheduleDocsWarmup(parsed.tab);
        }
    }
}

/* ── Section-specific demo wiring ─────────────── */
function initSectionDemos(sectionEl) {
    if (!sectionEl) return;

    var badge = sectionEl.querySelector('#demo-morph-badge-btn');
    if (badge && !badge._morphBadgeInit) {
        badge._morphBadgeInit = true;
        var states  = JSON.parse(badge.getAttribute('data-morph-states')  || '[]');
        var classes = JSON.parse(badge.getAttribute('data-morph-classes') || '[]');
        var icons   = JSON.parse(badge.getAttribute('data-morph-icons')  || '[]');
        var idx = 0;
        var morphing = false;

        badge.addEventListener('click', function (e) {
            if (morphing) return;
            morphing = true;

            var nextIdx = (idx + 1) % states.length;
            var afterIdx = (nextIdx + 1) % states.length;

            var next = badge.querySelector('.vd-morph-next');
            if (next) {
                next.innerHTML = '<i class="ph ' + icons[nextIdx] + '" style="margin-right:0.35rem;"></i> ' + states[nextIdx];
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
                    current.innerHTML = '<i class="ph ' + icons[nextIdx] + '" style="margin-right:0.35rem;"></i> ' + states[nextIdx];
                }
                if (nextEl) {
                    nextEl.innerHTML = '<i class="ph ' + icons[afterIdx] + '" style="margin-right:0.35rem;"></i> ' + states[afterIdx];
                }

                idx = nextIdx;
                morphing = false;

                badge.classList.add('morph-done');
                setTimeout(function () { badge.classList.remove('morph-done'); }, 350);
            }, 520);
        });
    }
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
    docWaterToggle.addEventListener('click', function (e) {
        if (_toggleMorphing) return;

        var toggle = this;
        var parsed = parseHash(location.hash);
        var activeTab = currentTab || parsed.tab || 'components';
        var destTab = activeTab === 'guides' ? 'components' : 'guides';
        var oppositeTab = destTab === 'guides' ? 'components' : 'guides';

        var next = toggle.querySelector('.vd-morph-next');
        if (next) _setToggleContent(next, destTab);

        var wave = toggle.querySelector('.vd-morph-wave');
        if (wave) {
            var rect = toggle.getBoundingClientRect();
            wave.style.left = ((e.clientX || rect.left + rect.width / 2) - rect.left) + 'px';
            wave.style.top  = ((e.clientY || rect.top  + rect.height / 2) - rect.top)  + 'px';
        }

        _toggleMorphing = true;
        toggle.classList.add('is-morphing');

        var morphDuration = 700;

        setTimeout(function () {
            toggle.classList.remove('is-morphing');

            var current = toggle.querySelector('.vd-morph-current');
            var nextEl  = toggle.querySelector('.vd-morph-next');
            if (current) _setToggleContent(current, destTab);
            if (nextEl)  _setToggleContent(nextEl,  oppositeTab);

            var toGuides = destTab === 'guides';
            toggle.setAttribute('aria-pressed', String(toGuides));
            toggle.setAttribute('aria-label', toGuides ? 'Switch to Components' : 'Switch to Guides');

            _toggleMorphing = false;

            toggle.classList.add('morph-done');
            setTimeout(function () { toggle.classList.remove('morph-done'); }, 350);
        }, morphDuration);

        var tabRoutes = { components: 'docs/components', guides: 'docs/guides' };
        navigate(tabRoutes[destTab] || 'docs/components');
    });
}

/* ── Track Water Morph wrapper height for sticky sidebar (--doc-tabs-height) ── */
(function () {
    var wrapper = document.querySelector('.doc-water-toggle-wrapper');
    if (!wrapper) {
        document.documentElement.style.setProperty('--doc-tabs-height', '0px');
        return;
    }
    var updateHeightVar = function () {
        document.documentElement.style.setProperty('--doc-tabs-height', wrapper.offsetHeight + 'px');
    };
    var ro = new ResizeObserver(function () {
        updateHeightVar();
    });
    ro.observe(wrapper);
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
        requestDocScrollLoaderForRoute('docs/' + id);
        closeMobileToc();
        var sidebarFilterInput = document.getElementById('doc-sidebar-filter-input');
        if (sidebarFilterInput) { sidebarFilterInput.value = ''; filterSidebarNav(''); }
        navigate('docs/' + id);
    });
    dynamicNavList.addEventListener('pointerenter', function (e) {
        var link = e.target.closest('.doc-nav-link[data-section]');
        if (!link) return;
        prefetchSection(link.getAttribute('data-section'));
    }, true);
    dynamicNavList.addEventListener('touchstart', function (e) {
        var link = e.target.closest('.doc-nav-link[data-section]');
        if (!link) return;
        prefetchSection(link.getAttribute('data-section'));
    }, { passive: true });
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

// Apply theme using the real framework component behavior so system mode
// matches the navbar implementation exactly.
function applyTheme(theme) {
    var themeSwitcher = window.Vanduo
        && window.Vanduo.components
        && window.Vanduo.components.themeSwitcher;

    if (themeSwitcher && typeof themeSwitcher.setPreference === 'function') {
        themeSwitcher.setPreference(theme);
        return;
    }

    // Fallback: mirror the framework's system handling by removing the
    // attribute instead of setting data-theme="system".
    if (theme === 'system') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }

    localStorage.setItem('vanduo-theme-preference', theme);
}

/** Copy legacy demo keys into framework storage keys once (radius/font). */
function migrateLegacyCustomizerDemoStorage() {
    try {
        if (!localStorage.getItem('vanduo-radius') && localStorage.getItem('vanduo-border-radius')) {
            localStorage.setItem('vanduo-radius', localStorage.getItem('vanduo-border-radius'));
        }
        if (!localStorage.getItem('vanduo-font-preference') && localStorage.getItem('vanduo-font-family')) {
            localStorage.setItem('vanduo-font-preference', localStorage.getItem('vanduo-font-family'));
        }
    } catch (_e) {
        /* ignore */
    }
}

// Theme Customizer Demo - Font Family
function initFontSelectListener() {
    var fontSelect = document.querySelector('.font-select');
    if (fontSelect) {
        try {
            var storedFont = localStorage.getItem('vanduo-font-preference');
            if (storedFont) {
                fontSelect.value = storedFont;
            }
        } catch (_e) {
            /* ignore */
        }
        fontSelect.addEventListener('change', function() {
            var font = this.value;
            if (font) {
                document.documentElement.setAttribute('data-font', font);
                localStorage.setItem('vanduo-font-preference', font);
                updateCustomizerDemoState();
            }
        });
    }
}

// Update visual state of customizer demo buttons
function updateCustomizerDemoState() {
    var html = document.documentElement;
    var theme = html.getAttribute('data-theme') || 'system';
    var primary = html.getAttribute('data-primary');
    if (!primary && window.ThemeCustomizer && typeof window.ThemeCustomizer.getDefaultPrimary === 'function') {
        var tm = (window.ThemeCustomizer.state && window.ThemeCustomizer.state.theme) ? window.ThemeCustomizer.state.theme : 'system';
        primary = window.ThemeCustomizer.getDefaultPrimary(tm);
    }
    if (!primary) {
        primary = 'black';
    }
    var neutral = html.getAttribute('data-neutral') || 'neutral';
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
        var font = html.getAttribute('data-font') || 'jetbrains-mono';
        fontSelect.value = font;
    }
}

// Initialize customizer demo on page load
document.addEventListener('DOMContentLoaded', function() {
    migrateLegacyCustomizerDemoStorage();
    initFontSelectListener();
    updateCustomizerDemoState();
});

document.addEventListener('draggable:drop', function (e) {
    // Draggable: Drop Zone Demo
    if (e.target.id === 'demo-drop-zone') {
        e.target.appendChild(e.detail.element);
    }
});

wireRouteLinks(document.querySelector('.vd-footer'));

window.addEventListener('hashchange', function () { handleRoute(); });
window.addEventListener('scroll', requestActiveDocSectionUpdate, { passive: true });
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
    requestDocScrollLoaderForRoute(result.route);
    closeGlobalSearch();
    navigate(result.route);
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
    document.getElementById('global-search-results').addEventListener('pointerover', function (e) {
        var item = e.target.closest('.global-search-result[data-route]');
        if (!item) return;
        var sectionId = parseSectionIdFromRoute(item.dataset.route);
        if (sectionId) prefetchSection(sectionId);
    });
    document.getElementById('global-search-results').addEventListener('touchstart', function (e) {
        var item = e.target.closest('.global-search-result[data-route]');
        if (!item) return;
        var sectionId = parseSectionIdFromRoute(item.dataset.route);
        if (sectionId) prefetchSection(sectionId);
    }, { passive: true });

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
        requestDocScrollLoaderForRoute(result.route);
        closeHeroDropdown();
        var input = document.getElementById('hero-search-input');
        if (input) { input.value = ''; input.blur(); }
        heroSearchState.query = '';
        heroSearchState.results = [];
        heroSearchState.activeIndex = -1;
        navigate(result.route);
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
    document.addEventListener('pointerover', function (e) {
        var item = e.target.closest('.hero-search-dropdown .global-search-result[data-route]');
        if (!item) return;
        var sectionId = parseSectionIdFromRoute(item.getAttribute('data-route'));
        if (sectionId) prefetchSection(sectionId);
    });
    document.addEventListener('touchstart', function (e) {
        var item = e.target.closest('.hero-search-dropdown .global-search-result[data-route]');
        if (!item) return;
        var sectionId = parseSectionIdFromRoute(item.getAttribute('data-route'));
        if (sectionId) prefetchSection(sectionId);
    }, { passive: true });
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

    // Also listen for OS preference changes when in system mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateIcon);
})();

/* ── Init ───────────────────────────────────── */
(async function () {
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
