import { state } from './state.js';
import {
    destroyVanduoScope,
    hideDisabledCodeTabs,
    initVanduoScope,
    safeInjectHtml,
    setDocumentTitle,
    wireRouteLinks,
    withDocsContentVersion
} from './utils.js';
import { findPageMeta, getTabForSection } from './registry.js';
import {
    getPagePlaceholderHtml,
    hideDocScrollLoader,
    leaveDocsView,
    loadSection,
    primeDocNavigationForHash,
    switchTab
} from './doc-navigation.js';
import { setActiveNavbarLink, syncDocsTabState } from './sidebar.js';
import {
    cleanupHeroSubtitleRotate,
    initHeroSubtitleRotate,
    initHexGridDemo
} from './demos.js';

export function showView(view) {
    var pageView = document.getElementById('page-view');
    var docsView = document.getElementById('docs-view');
    if (view === 'docs') {
        pageView.classList.remove('is-active');
        docsView.classList.add('is-active');
        if (state.currentTab) {
            syncDocsTabState(state.currentTab);
        }
    } else {
        docsView.classList.remove('is-active');
        pageView.classList.add('is-active');
        var dynamicContent = document.getElementById('dynamic-content');
        if (dynamicContent) {
            destroyVanduoScope(dynamicContent);
        }
        leaveDocsView();
    }
    state.currentView = view;
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

export function initChangelogPagination(pageId, container) {
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

export async function loadPage(pageId, options = {}) {
    hideDocScrollLoader();
    if (state.currentView === pageId && document.getElementById(pageId)) {
        if (pageId === 'templates') {
            initTemplatesPage(options.templateSlug || null);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    showView(pageId);
    setActiveNavbarLink(pageId);
    var container = document.getElementById('page-view');

    cleanupHeroSubtitleRotate(container);
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
        var res = await fetch(withDocsContentVersion('./sections/' + page.file), { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load ' + page.file);
        var html = await res.text();
        safeInjectHtml(container, html);
        initVanduoScope(container);
        hideDisabledCodeTabs(container);
        wireRouteLinks(container, navigate);
        initChangelogPagination(pageId, container);
        initHexGridDemo();
        if (pageId === 'home') {
            initHeroSubtitleRotate(container);
        }
        if (pageId === 'templates') {
            initTemplatesPage(options.templateSlug || null);
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="vd-alert vd-alert-error" style="margin: 2rem;">Failed to load page. Check console.</div>';
    }
}

export function parseHash(hash) {
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

export async function navigate(route, options) {
    primeDocNavigationForHash('#' + route, options);
    if (window.history && window.history.pushState) {
        window.history.pushState(null, '', '#' + route);
    }
    await handleRoute();
}

/**
 * Top-level router. Parses the URL hash and dispatches to the correct view.
 */
export async function handleRoute() {
    if (state.currentNavigationController) {
        state.currentNavigationController.abort();
    }
    state.currentNavigationController = new AbortController();
    var signal = state.currentNavigationController.signal;

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

    if (state.currentTab !== parsed.tab) {
        await switchTab(parsed.tab, {
            signal: signal,
            initialSectionId: parsed.section || undefined
        });
    } else if (parsed.section) {
        await loadSection(parsed.section, true, { signal: signal });
    }
}
