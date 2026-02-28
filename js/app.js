if (typeof window.Vanduo === 'undefined') {
    console.error('Vanduo failed to load from CDN. Check network/CDN availability.');
} else {
    window.Vanduo.init();
}

/* ── Disabled code-snippet tab → info toast ────── */
(function () {
    var lastToast = 0;
    function handleDisabledTab(e) {
        var now = Date.now();
        if (now - lastToast < 1500) return;
        var el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || !el.matches || !el.matches('.vd-code-snippet-tab[disabled]')) return;
        lastToast = now;
        var lang = (el.getAttribute('data-lang') || '').toUpperCase();
        if (typeof Toast !== 'undefined') {
            Toast.info(lang + ' is not used in this example.');
        }
    }
    document.addEventListener('mousedown', handleDisabledTab, true);
})();

/* ── Constants ────────────────────────────────── */
const SECTIONS_BASE = './sections/';
let registry = { pages: [], tabs: {} };
const loadedSections = new Set();
const loadingSections = new Set();
let scrollSpyObserver = null;
let docLazyLoader = null;
let currentView = null;
let currentTab = null;

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

/* ── Doc-tabs state ───────────────────────────── */
function setActiveTab(tabKey) {
    document.querySelectorAll('.doc-tab').forEach(function (tab) {
        tab.classList.toggle('active', tab.getAttribute('data-tab') === tabKey);
    });
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
        wireRouteLinks(container);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="vd-alert vd-alert-error" style="margin: 2rem;">Failed to load page. Check console.</div>';
    }
}

/* ── Section loading (docs) ───────────────────── */
async function loadSection(sectionId, autoScroll = true) {
    if (loadedSections.has(sectionId)) {
        var el = document.getElementById(sectionId);
        if (el && autoScroll) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveNavLink(sectionId);
        return;
    }
    if (loadingSections.has(sectionId)) {
        return; // Deduplicate
    }
    loadingSections.add(sectionId);

    var meta = findSectionMeta(sectionId);
    if (!meta) {
        loadingSections.delete(sectionId);
        return;
    }

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

    if (autoScroll) placeholder.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveNavLink(sectionId);

    try {
        var url = SECTIONS_BASE + meta.section.file;
        var res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load ' + url);
        var html = await res.text();
        var wrap = document.createElement('div');
        wrap.innerHTML = html.trim();
        var sectionEl = wrap.firstElementChild;
        if (sectionEl) {
            container.replaceChild(sectionEl, placeholder);
            loadedSections.add(sectionId);
            if (typeof Vanduo !== 'undefined') Vanduo.init();
            wireRouteLinks(sectionEl);
        } else {
            placeholder.remove();
        }
        setupScrollSpy();
        setupInfiniteScroll();

        var target = document.getElementById(sectionId);
        if (target && autoScroll) target.scrollIntoView({ behavior: 'smooth', block: 'start' });

        if (autoScroll) {
            setActiveNavLink(sectionId);
            setDocumentTitle(meta.section.title);
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', '#docs/' + sectionId);
            }
        }
    } catch (err) {
        placeholder.remove();
        console.error(err);
        container.insertAdjacentHTML('beforeend',
            '<div class="vd-alert vd-alert-error">Failed to load section. Check console.</div>');
    } finally {
        loadingSections.delete(sectionId);
    }
}

/* ── Switch docs tab ──────────────────────────── */
async function switchTab(tabKey) {
    if (currentTab === tabKey) return;
    currentTab = tabKey;
    setActiveTab(tabKey);

    var container = document.getElementById('dynamic-content');
    container.innerHTML = '';
    loadedSections.clear();
    loadingSections.clear();
    if (docLazyLoader) {
        docLazyLoader.disconnect();
    }

    buildSidebar(tabKey);
    closeMobileToc();

    var orderedIds = getOrderedIds(tabKey);
    if (orderedIds.length > 0) {
        await loadSection(orderedIds[0]);
    }
}

/* ── Scroll-spy ───────────────────────────────── */
function setupScrollSpy() {
    var content = document.getElementById('dynamic-content');
    if (!content) return;
    if (scrollSpyObserver) scrollSpyObserver.disconnect();
    var sections = content.querySelectorAll('section[id]');
    if (!sections.length) return;
    scrollSpyObserver = new IntersectionObserver(function (entries) {
        // Find the most prominent intersecting entry (if multiple, take the first one or the one with biggest intersection ratio)
        var intersecting = entries.filter(function (e) { return e.isIntersecting; });
        if (!intersecting.length) return;

        // Use the last intersecting one or max ratio? Just loop them.
        intersecting.forEach(function (entry) {
            setActiveNavLink(entry.target.id);
            var meta = findSectionMeta(entry.target.id);
            if (meta && meta.section) {
                setDocumentTitle(meta.section.title);
                if (window.history && window.history.replaceState) {
                    var targetHashBase = '#docs/' + entry.target.id;
                    // Only replace the hash if the current hash does NOT start with targetHashBase.
                    // This preserves '#docs/buttons#sizes' when scrolling within the 'buttons' section.
                    // To prevent a newly loaded lazy-section from stealing the hash while 'buttons' is still in view,
                    // we can verify if the new entry actually takes up a significant portion, or just let it update.
                    if (!window.location.hash.startsWith(targetHashBase)) {
                        window.history.replaceState(null, '', targetHashBase);
                    }
                }
            }
        });
    }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });
    sections.forEach(function (sec) { scrollSpyObserver.observe(sec); });
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
        loadSection(orderedIds[nextIndex], false); // autoScroll = false
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

/* ── Router ───────────────────────────────────── */
function parseHash(hash) {
    var h = (hash || '').replace(/^#\/?/, '');
    if (!h || h === 'home') return { view: 'home' };
    if (h === 'about') return { view: 'about' };
    if (h === 'changelog') return { view: 'changelog' };
    if (h === 'docs') return { view: 'docs-landing' };
    if (h === 'docs/components') return { view: 'docs', tab: 'components', section: null };
    if (h === 'docs/concepts') return { view: 'docs', tab: 'concepts', section: null };
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
    var parsed = parseHash(location.hash);

    if (parsed.view === 'home' || parsed.view === 'about' || parsed.view === 'changelog' || parsed.view === 'docs-landing') {
        await loadPage(parsed.view);
        if (parsed.view === 'docs-landing') {
            setActiveNavbarLink('docs');
        }
        return;
    }

    showView('docs');
    setActiveNavbarLink('docs');

    if (currentTab !== parsed.tab) {
        await switchTab(parsed.tab);
    }

    if (parsed.section) {
        await loadSection(parsed.section);
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

document.querySelectorAll('.doc-tab[data-tab]').forEach(function (tab) {
    tab.addEventListener('click', function (e) {
        e.preventDefault();
        var tabKey = tab.getAttribute('data-tab');
        var tabRoutes = { components: 'docs/components', guides: 'docs/guides', concepts: 'docs/concepts' };
        navigate(tabRoutes[tabKey] || 'docs');
    });
});

/* ── Track doc-tabs-wrapper height for sticky sidebar (--doc-tabs-height) ── */
(function () {
    var wrapper = document.querySelector('.doc-tabs-wrapper');
    if (!wrapper) return;
    var ro = new ResizeObserver(function () {
        document.documentElement.style.setProperty(
            '--doc-tabs-height', wrapper.offsetHeight + 'px'
        );
    });
    ro.observe(wrapper);
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
        closeMobileToc();
        navigate('docs/' + id);
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
});

document.addEventListener('draggable:drop', function (e) {
    // Draggable: Drop Zone Demo
    if (e.target.id === 'demo-drop-zone') {
        e.target.appendChild(e.detail.element);
    }
});

wireRouteLinks(document.querySelector('.vd-footer'));

window.addEventListener('hashchange', function () { handleRoute(); });

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
        title: 'Documentation',
        category: 'Pages',
        tab: 'Pages',
        keywords: 'documentation doc docs components guides concepts',
        icon: 'ph-book-open',
        route: 'docs'
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
}

/* ── Init ───────────────────────────────────── */
(async function () {
    await loadRegistry();
    initGlobalSearch();
    await handleRoute();
})();
