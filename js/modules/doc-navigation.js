import {
    ACTIVE_DOC_SECTION_TOLERANCE,
    DOC_BOTTOM_BOUNDARY_SENTINEL_ID,
    DOC_BOUNDARY_ROOT_MARGIN,
    DOC_EXPLICIT_NAV_COOLDOWN_MS,
    DOC_NEIGHBOR_PREFETCH_RADIUS,
    DOC_RUNWAY_BOTTOM_THRESHOLD,
    DOC_TOP_BOUNDARY_SENTINEL_ID,
    DOC_USER_SCROLL_CANCEL_THRESHOLD,
    SCROLL_SPY_OFFSET,
    SECTIONS_BASE,
    loadedSections,
    loadingSections,
    state
} from './state.js';
import {
    destroyVanduoScope,
    extractDocsSectionId,
    hideDisabledCodeTabs,
    initVanduoScope,
    safeInjectHtml,
    setDocumentTitle,
    wireRouteLinks,
    withDocsContentVersion
} from './utils.js';
import {
    findSectionMeta,
    getCachedSectionHtml,
    getOrderedIds,
    getTabForSection,
    prefetchSection,
    setCachedSectionHtml
} from './registry.js';
import {
    buildSidebar,
    clearNavigatingNavLinks,
    closeMobileToc,
    setActiveDocMode,
    setActiveNavLink,
    syncDocsTabState
} from './sidebar.js';
import { initSectionDemos } from './demos.js';

var navigateForRouteLinks = null;

export function setDocNavigationRouter(navigateFn) {
    navigateForRouteLinks = typeof navigateFn === 'function' ? navigateFn : null;
}

/* ============================================================================
 * NAVIGATION STATE MACHINE
 * ============================================================================
 *
 * IDLE -> PENDING -> SETTLING -> SETTLED -> IDLE
 *                 \-> CANCELLED -> IDLE
 *
 * pendingDocNavigationId freezes scroll-spy and boundary loading during an
 * explicit sidebar/hash navigation. settleDocNavigationScroll owns a generation
 * counter so stale rAF loops exit when a newer navigation or cancellation wins.
 * docExplicitNavSectionId/docExplicitNavCooldownUntil preserve the sidebar
 * active state while layout settles or the user cancels by scrolling.
 * docNavSuppressBoundaryScroll ignores teardown scroll events during target-
 * first DOM resets.
 * ============================================================================ */

function parseDocsTarget(hashOrRoute) {
    var h = String(hashOrRoute || '').replace(/^#\/?/, '');
    if (!h.startsWith('docs/')) return { view: null, tab: null, section: null };
    if (h === 'docs/components') return { view: 'docs', tab: 'components', section: null };
    if (h === 'docs/guides') return { view: 'docs', tab: 'guides', section: null };

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

/**
 * Clear the pending navigation lock, optionally after a delay.
 * While pendingDocNavigationId is set, scroll-spy and boundary loading are frozen.
 * @param {number} [delayMs=0] - ms to wait before clearing; 0 = immediate.
 */
export function releasePendingDocNavigation(delayMs = 0) {
    if (state.pendingDocNavigationReleaseTimer) {
        clearTimeout(state.pendingDocNavigationReleaseTimer);
        state.pendingDocNavigationReleaseTimer = null;
    }
    if (delayMs > 0) {
        state.pendingDocNavigationReleaseTimer = setTimeout(function () {
            state.pendingDocNavigationId = null;
            state.pendingDocNavigationReleaseTimer = null;
        }, delayMs);
        return;
    }
    state.pendingDocNavigationId = null;
}

/**
 * Flag the next ~120ms of scroll events as programmatic (code-driven).
 * Prevents handleDocBoundaryScroll from interpreting scrollIntoView drift
 * corrections as intentional user scroll, which would cancel settlement.
 */
export function markProgrammaticScroll() {
    state.docProgrammaticScroll = true;
    if (state.docProgrammaticScrollTimer) {
        clearTimeout(state.docProgrammaticScrollTimer);
    }
    state.docProgrammaticScrollTimer = setTimeout(function () {
        state.docProgrammaticScroll = false;
        state.docProgrammaticScrollTimer = null;
    }, 120);
}

/**
 * Abort any in-flight settlement loop. Increments the generation counter so
 * the rAF loop exits, and releases the pending navigation lock. Does NOT
 * clear docExplicitNavSectionId / docExplicitNavCooldownUntil.
 */
export function cancelDocNavigationSettlement() {
    state.docNavigationSettleGeneration += 1;
    state.docNavSuppressBoundaryScroll = false;
    releasePendingDocNavigation(0);
    hideDocScrollLoader();
}

/**
 * Lock the sidebar active state to a section for DOC_EXPLICIT_NAV_COOLDOWN_MS.
 * During the cooldown, scroll-spy cannot overwrite the active section.
 * @param {string} sectionId - the section to lock as active.
 */
export function lockExplicitDocNav(sectionId) {
    if (!sectionId) return;
    state.docExplicitNavSectionId = sectionId;
    state.docExplicitNavCooldownUntil = Date.now() + DOC_EXPLICIT_NAV_COOLDOWN_MS;
}

function clearDocScrollLoaderFallbackTimer() {
    if (state.docScrollLoaderFallbackTimer) {
        clearTimeout(state.docScrollLoaderFallbackTimer);
        state.docScrollLoaderFallbackTimer = null;
    }
}

export function requestDocScrollLoaderForRoute(route) {
    if (typeof route !== 'string' || !route.startsWith('docs/')) {
        state.requestedDocScrollLoaderSectionId = null;
        return;
    }
    var parsed = parseDocsTarget(route);
    state.requestedDocScrollLoaderSectionId = parsed && parsed.section ? parsed.section : extractDocsSectionId(route);
}

export function shouldRequestDocScrollLoaderForRoute(route, options) {
    if (options && options.showScrollLoader === true) return true;
    if (options && options.showScrollLoader === false) return false;

    var parsed = parseDocsTarget(route);
    if (parsed.view !== 'docs' || !parsed.section) return false;
    if (state.currentView === 'docs' && state.currentTab === parsed.tab) return false;

    return true;
}

export function primeDocNavigationForHash(hash, options) {
    if (window.history && 'scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
    }

    var parsed = parseDocsTarget(hash);
    var sectionId = parsed && parsed.view === 'docs' && parsed.section
        ? parsed.section
        : extractDocsSectionId(hash);
    if (!sectionId) {
        state.requestedDocScrollLoaderSectionId = null;
        return;
    }

    var route = 'docs/' + sectionId;
    if (shouldRequestDocScrollLoaderForRoute(route, options || {})) {
        requestDocScrollLoaderForRoute(route);
    } else {
        state.requestedDocScrollLoaderSectionId = null;
    }
    state.pendingDocNavigationId = sectionId;
    state.docPendingNavigationStartedAt = Date.now();
}

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

export function getPagePlaceholderHtml() {
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

/**
 * Remove all spinner/skeleton placeholder elements from the docs container.
 * Called after settlement or cancellation to clean up loading indicators.
 */
export function hideDocScrollLoader() {
    clearDocScrollLoaderFallbackTimer();
    clearNavigatingNavLinks();
    if (state.docScrollLoaderEl) {
        state.docScrollLoaderEl.remove();
        state.docScrollLoaderEl = null;
    }
    state.docScrollLoaderTargetId = null;
}

function showDocScrollLoader(sectionId) {
    if (!sectionId) return;
    var docsView = document.getElementById('docs-view');
    if (!docsView || !docsView.classList.contains('is-active')) return;

    hideDocScrollLoader();

    state.docScrollLoaderEl = document.createElement('div');
    state.docScrollLoaderEl.className = 'doc-scroll-loader-card';
    state.docScrollLoaderEl.setAttribute('role', 'status');
    state.docScrollLoaderEl.setAttribute('aria-live', 'polite');
    state.docScrollLoaderEl.innerHTML = getDocScrollLoaderHtml();
    document.body.appendChild(state.docScrollLoaderEl);
    window.requestAnimationFrame(function () {
        if (state.docScrollLoaderEl) state.docScrollLoaderEl.classList.add('is-visible');
    });

    state.docScrollLoaderTargetId = sectionId;
    clearDocScrollLoaderFallbackTimer();
    state.docScrollLoaderFallbackTimer = setTimeout(hideDocScrollLoader, 4500);
}

/**
 * Run a rAF loop that waits for a section to reach its scroll target and
 * stabilize. Applies up to MAX_DRIFT_CORRECTIONS scrollIntoView corrections.
 * @param {string} sectionId - target section to settle on.
 * @param {Function} [onSettled] - callback after settlement.
 */
export function settleDocNavigationScroll(sectionId, onSettled) {
    if (!sectionId) return;

    var generation = ++state.docNavigationSettleGeneration;

    function finishSettlement() {
        if (generation !== state.docNavigationSettleGeneration) return;
        releasePendingDocNavigation(0);
        state.activeDocSectionId = sectionId;
        setActiveNavLink(sectionId);
        var settledMeta = findSectionMeta(sectionId);
        if (settledMeta && settledMeta.section) {
            setDocumentTitle(settledMeta.section.title);
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', '#docs/' + sectionId);
            }
        }
        lockExplicitDocNav(sectionId);
        if (typeof onSettled === 'function') {
            onSettled();
        }
    }

    var MAX_DRIFT_CORRECTIONS = 5;
    var STABLE_WINDOW_MS = 400;
    var deadline = Date.now() + 2400;
    var driftCorrections = 0;
    var stableSince = 0;
    var showLoader = state.docScrollLoaderEl && state.docScrollLoaderTargetId === sectionId;

    function checkScrollCompletion() {
        if (generation !== state.docNavigationSettleGeneration) {
            if (showLoader) hideDocScrollLoader();
            return;
        }
        if (state.pendingDocNavigationId !== sectionId) {
            if (showLoader) hideDocScrollLoader();
            finishSettlement();
            return;
        }

        var target = document.getElementById(sectionId);
        if (!target) {
            if (Date.now() >= deadline) {
                if (showLoader) hideDocScrollLoader();
                finishSettlement();
            } else {
                window.requestAnimationFrame(checkScrollCompletion);
            }
            return;
        }

        var targetTop = target.getBoundingClientRect().top;
        var driftedDown = targetTop > (SCROLL_SPY_OFFSET + ACTIVE_DOC_SECTION_TOLERANCE);
        var driftedUp = targetTop < -4;
        if ((driftedDown || driftedUp) && driftCorrections < MAX_DRIFT_CORRECTIONS) {
            markProgrammaticScroll();
            target.scrollIntoView({ behavior: 'instant', block: 'start' });
            driftCorrections += 1;
            stableSince = 0;
        }

        var currentTop = target.getBoundingClientRect().top;
        var reachedTarget = currentTop <= (SCROLL_SPY_OFFSET + ACTIVE_DOC_SECTION_TOLERANCE) && currentTop >= -4;
        if (reachedTarget) {
            if (!stableSince) stableSince = Date.now();
            if (Date.now() - stableSince >= STABLE_WINDOW_MS) {
                if (showLoader) hideDocScrollLoader();
                finishSettlement();
                return;
            }
        } else {
            stableSince = 0;
        }
        if (Date.now() >= deadline) {
            if (showLoader) hideDocScrollLoader();
            finishSettlement();
            return;
        }
        window.requestAnimationFrame(checkScrollCompletion);
    }

    window.requestAnimationFrame(checkScrollCompletion);
}

export function settleDocScrollLoader(sectionId) {
    settleDocNavigationScroll(sectionId);
}

function getCurrentDocOrderedIds() {
    return state.currentTab ? getOrderedIds(state.currentTab) : [];
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

/**
 * Decide whether to tear down all loaded sections before navigating.
 * @param {string} sectionId - navigation target.
 * @param {boolean} autoScroll - true for explicit user navigation.
 * @returns {boolean}
 */
function shouldResetDocsForExplicitNav(sectionId, autoScroll) {
    if (!autoScroll || !sectionId) return false;
    var range = getLoadedDocSectionRange();
    if (!range) return false;
    return range.firstId !== sectionId || range.lastId !== sectionId;
}

function getNeighborSectionId(sectionId, offset) {
    if (!sectionId || !state.currentTab || !offset) return null;
    var orderedIds = getCurrentDocOrderedIds();
    var index = orderedIds.indexOf(sectionId);
    if (index === -1) return null;
    var neighborIndex = index + offset;
    if (neighborIndex < 0 || neighborIndex >= orderedIds.length) return null;
    return orderedIds[neighborIndex];
}

function prefetchDocNeighborsAround(sectionId, radius = DOC_NEIGHBOR_PREFETCH_RADIUS) {
    if (!sectionId || !state.currentTab) return;
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
    if (state.docTopBoundaryObserver) {
        state.docTopBoundaryObserver.disconnect();
    }
    if (state.docBottomBoundaryObserver) {
        state.docBottomBoundaryObserver.disconnect();
    }
}

function disarmDocBoundaries() {
    state.docTopBoundaryArmed = false;
    state.docBottomBoundaryArmed = false;
    disconnectDocBoundaryObservers();
}

/**
 * Tear down all loaded section DOM nodes, clear tracking sets, destroy
 * observers, and hide loaders.
 * @param {Object} [options]
 * @param {boolean} [options.destroyScope]
 */
export function resetDocsSectionRenderState(options = {}) {
    var container = document.getElementById('dynamic-content');

    state.docContentEpoch += 1;
    disarmDocBoundaries();
    removeDocBoundarySentinel(state.docTopBoundaryEl);
    removeDocBoundarySentinel(state.docBottomBoundaryEl);
    state.docTopBoundaryEl = null;
    state.docBottomBoundaryEl = null;
    state.docBoundaryPrevLoading = false;
    state.docBoundaryNextLoading = false;
    state.docLastKnownScrollY = window.scrollY || window.pageYOffset || 0;

    if (state.scrollSpyObserver) {
        state.scrollSpyObserver.disconnect();
        state.scrollSpyObserver = null;
    }
    state.activeDocSectionId = null;
    state.scrollSpyTicking = false;
    loadedSections.clear();
    loadingSections.clear();

    if (!container) return;

    if (options.destroyScope !== false) {
        destroyVanduoScope(container);
    }
    container.innerHTML = '';
}

function isDocContentStale(loadEpoch) {
    return loadEpoch !== state.docContentEpoch;
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
    state.docTopBoundaryEl = createDocBoundarySentinel(DOC_TOP_BOUNDARY_SENTINEL_ID);
    state.docBottomBoundaryEl = createDocBoundarySentinel(DOC_BOTTOM_BOUNDARY_SENTINEL_ID);
}

function ensureDocBoundaryObserver(direction) {
    if (direction === 'top') {
        if (!state.docTopBoundaryObserver) {
            state.docTopBoundaryObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting || !state.docTopBoundaryArmed || state.docBoundaryPrevLoading) return;
                    state.docTopBoundaryArmed = false;
                    disconnectDocBoundaryObservers();
                    loadPreviousSection();
                });
            }, { rootMargin: DOC_BOUNDARY_ROOT_MARGIN, threshold: 0 });
        }
        return state.docTopBoundaryObserver;
    }

    if (!state.docBottomBoundaryObserver) {
        state.docBottomBoundaryObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting || !state.docBottomBoundaryArmed || state.docBoundaryNextLoading) return;
                state.docBottomBoundaryArmed = false;
                disconnectDocBoundaryObservers();
                loadNextSection();
            });
        }, { rootMargin: DOC_BOUNDARY_ROOT_MARGIN, threshold: 0 });
    }
    return state.docBottomBoundaryObserver;
}

function syncDocBoundarySentinels() {
    var container = document.getElementById('dynamic-content');
    var range = getLoadedDocSectionRange();

    if (!container || !range) {
        removeDocBoundarySentinel(state.docTopBoundaryEl);
        removeDocBoundarySentinel(state.docBottomBoundaryEl);
        return;
    }

    ensureDocBoundarySentinels();

    var firstSection = document.getElementById(range.firstId);
    var lastSection = document.getElementById(range.lastId);
    var topCandidateId = range.firstIndex > 0 ? range.orderedIds[range.firstIndex - 1] : null;
    var bottomCandidateId = range.lastIndex < range.orderedIds.length - 1 ? range.orderedIds[range.lastIndex + 1] : null;

    if (topCandidateId && firstSection) {
        container.insertBefore(state.docTopBoundaryEl, firstSection);
    } else {
        state.docTopBoundaryArmed = false;
        removeDocBoundarySentinel(state.docTopBoundaryEl);
    }

    if (bottomCandidateId && lastSection) {
        container.insertBefore(state.docBottomBoundaryEl, lastSection.nextSibling);
    } else {
        state.docBottomBoundaryArmed = false;
        removeDocBoundarySentinel(state.docBottomBoundaryEl);
    }
}

function observeArmedDocBoundaries() {
    disconnectDocBoundaryObservers();
    syncDocBoundarySentinels();

    if (state.docTopBoundaryArmed && state.docTopBoundaryEl && state.docTopBoundaryEl.isConnected) {
        ensureDocBoundaryObserver('top').observe(state.docTopBoundaryEl);
    }

    if (state.docBottomBoundaryArmed && state.docBottomBoundaryEl && state.docBottomBoundaryEl.isConnected) {
        ensureDocBoundaryObserver('bottom').observe(state.docBottomBoundaryEl);
    }
}

function armDocBoundary(direction) {
    var range = getLoadedDocSectionRange();
    if (!range) return;

    if (direction === 'up') {
        if (range.firstIndex <= 0 || state.docBoundaryPrevLoading) return;
        state.docTopBoundaryArmed = true;
        state.docBottomBoundaryArmed = false;
    } else if (direction === 'down') {
        if (range.lastIndex >= range.orderedIds.length - 1 || state.docBoundaryNextLoading) return;
        state.docBottomBoundaryArmed = true;
        state.docTopBoundaryArmed = false;
    } else {
        return;
    }

    observeArmedDocBoundaries();
}

/**
 * Scroll listener on the docs content container.
 */
export function handleDocBoundaryScroll() {
    var nextScrollY = window.scrollY || window.pageYOffset || 0;
    var delta = nextScrollY - state.docLastKnownScrollY;

    if (state.docNavSuppressBoundaryScroll) {
        state.docLastKnownScrollY = nextScrollY;
        return;
    }

    if (state.pendingDocNavigationId && !state.docProgrammaticScroll
        && Math.abs(delta) > DOC_USER_SCROLL_CANCEL_THRESHOLD) {
        cancelDocNavigationSettlement();
    }
    if (state.pendingDocNavigationId) {
        state.docLastKnownScrollY = nextScrollY;
        return;
    }

    if (state.docExplicitNavSectionId && !state.docProgrammaticScroll
        && Math.abs(delta) > DOC_USER_SCROLL_CANCEL_THRESHOLD) {
        state.docExplicitNavSectionId = null;
    }

    if (delta < -1) {
        armDocBoundary('up');
    } else if (delta > 1) {
        armDocBoundary('down');
    }

    state.docLastKnownScrollY = nextScrollY;
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

/**
 * Fetch a docs section HTML from the server, inject it into the DOM, and
 * optionally scroll to it.
 */
export async function loadSection(sectionId, autoScroll = true, options = {}) {
    var signal = options.signal;
    var skipInfiniteRefresh = options.skipInfiniteRefresh === true;
    var skipRunway = options.skipRunway === true;
    var loadEpoch = state.docContentEpoch;
    if (signal && signal.aborted) return;

    if (autoScroll && state.requestedDocScrollLoaderSectionId === sectionId) {
        showDocScrollLoader(sectionId);
        state.requestedDocScrollLoaderSectionId = null;
    }

    if (autoScroll) {
        state.pendingDocNavigationId = sectionId;
        state.docPendingNavigationStartedAt = Date.now();
    }

    var needsTargetFirstReset = shouldResetDocsForExplicitNav(sectionId, autoScroll);
    if (needsTargetFirstReset) {
        if (autoScroll) {
            state.docNavSuppressBoundaryScroll = true;
        }
        resetDocsSectionRenderState();
        loadEpoch = state.docContentEpoch;
    }

    if (!needsTargetFirstReset && loadedSections.has(sectionId)) {
        var el = document.getElementById(sectionId);
        var loadedMeta = findSectionMeta(sectionId);
        if (el) {
            initVanduoScope(el);
        }
        if (el && autoScroll) {
            markProgrammaticScroll();
            el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
        if (autoScroll) {
            disarmDocBoundaries();
            settleDocNavigationScroll(sectionId, function () {
                if (!skipRunway) {
                    ensureDocsScrollRunway(sectionId, { signal: signal });
                }
                if (!skipInfiniteRefresh) {
                    setupInfiniteScroll();
                }
            });
        }
        setActiveNavLink(sectionId);
        if (loadedMeta && loadedMeta.section) {
            setDocumentTitle(loadedMeta.section.title);
            if (autoScroll && window.history && window.history.replaceState) {
                window.history.replaceState(null, '', '#docs/' + sectionId);
            }
            state.activeDocSectionId = sectionId;
            lockExplicitDocNav(sectionId);
            prefetchDocNeighborsAround(sectionId);
        }
        return;
    }

    var meta = findSectionMeta(sectionId);
    if (!meta) {
        return;
    }

    if (loadingSections.has(sectionId)) {
        if (autoScroll) {
            var becameAvailable = await waitForLoadingSection(sectionId, signal);
            if (signal && signal.aborted) return;
            if (becameAvailable) {
                var pendingTarget = document.getElementById(sectionId);
                if (pendingTarget) {
                    markProgrammaticScroll();
                    pendingTarget.scrollIntoView({ behavior: 'instant', block: 'start' });
                }
                disarmDocBoundaries();
                settleDocNavigationScroll(sectionId, function () {
                    if (!skipRunway) {
                        ensureDocsScrollRunway(sectionId, { signal: signal });
                    }
                    if (!skipInfiniteRefresh) {
                        setupInfiniteScroll();
                    }
                });
                setActiveNavLink(sectionId);
                setDocumentTitle(meta.section.title);
                if (window.history && window.history.replaceState) {
                    window.history.replaceState(null, '', '#docs/' + sectionId);
                }
                state.activeDocSectionId = sectionId;
                lockExplicitDocNav(sectionId);
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
            wireRouteLinks(sectionEl, navigateForRouteLinks);
            initSectionDemos(sectionEl);
            observeSection(sectionEl);
        } else {
            placeholder.remove();
        }
        if (!skipInfiniteRefresh && !autoScroll) {
            setupInfiniteScroll();
        }

        var target = document.getElementById(sectionId);
        if (target && autoScroll) {
            state.docNavSuppressBoundaryScroll = false;
            markProgrammaticScroll();
            target.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
        if (autoScroll) {
            disarmDocBoundaries();
            settleDocNavigationScroll(sectionId, function () {
                if (!skipRunway) {
                    ensureDocsScrollRunway(sectionId, { signal: signal });
                }
                if (!skipInfiniteRefresh) {
                    setupInfiniteScroll();
                }
            });
        } else if (!skipInfiniteRefresh) {
            setupInfiniteScroll();
        }

        if (autoScroll) {
            setActiveNavLink(sectionId);
            setDocumentTitle(meta.section.title);
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', '#docs/' + sectionId);
            }
            state.activeDocSectionId = sectionId;
            lockExplicitDocNav(sectionId);
            prefetchDocNeighborsAround(sectionId);
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
        if (!loadedSections.has(sectionId)) {
            state.docNavSuppressBoundaryScroll = false;
            var orphanPlaceholder = document.getElementById('dynamic-placeholder-' + sectionId);
            if (orphanPlaceholder) orphanPlaceholder.remove();
        }
    }
}

/**
 * Switch the active tab and load its content.
 */
export async function switchTab(tabKey, options = {}) {
    var signal = options.signal;
    if (signal && signal.aborted) return;
    hideDocScrollLoader();
    if (state.currentTab === tabKey) return;
    state.currentTab = tabKey;
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

/**
 * Immediately update URL hash, document title, and sidebar active state.
 * @param {string} sectionId - the section now considered active.
 */
export function syncActiveDocSection(sectionId) {
    if (!sectionId) return;
    var docsView = document.getElementById('docs-view');
    if (!docsView || !docsView.classList.contains('is-active')) return;
    if (state.pendingDocNavigationId && sectionId !== state.pendingDocNavigationId) return;
    state.activeDocSectionId = sectionId;
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

/**
 * Determine which section is currently active for sidebar highlighting.
 * @returns {string|null}
 */
export function getActiveDocSectionId() {
    if (!state.currentTab) return null;
    var orderedIds = getOrderedIds(state.currentTab);
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

/**
 * Throttled (rAF) scroll-spy callback.
 */
export function updateActiveDocSection() {
    state.scrollSpyTicking = false;
    if (state.pendingDocNavigationId) return;
    if (Date.now() < state.docExplicitNavCooldownUntil) {
        if (state.docExplicitNavSectionId && state.docExplicitNavSectionId !== state.activeDocSectionId) {
            state.activeDocSectionId = state.docExplicitNavSectionId;
            setActiveNavLink(state.docExplicitNavSectionId);
        }
        return;
    }
    var hashSection = extractDocsSectionId(location.hash);
    if (state.docExplicitNavSectionId && hashSection === state.docExplicitNavSectionId) {
        return;
    }
    var docsView = document.getElementById('docs-view');
    if (!docsView || !docsView.classList.contains('is-active')) return;
    var nextSectionId = getActiveDocSectionId();
    if (!nextSectionId || nextSectionId === state.activeDocSectionId) return;
    syncActiveDocSection(nextSectionId);
}

export function requestActiveDocSectionUpdate() {
    if (state.pendingDocNavigationId) return;
    if (state.scrollSpyTicking) return;
    state.scrollSpyTicking = true;
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

function observeSection(sectionEl) {
    if (!sectionEl || !sectionEl.id) return;
    if (!state.scrollSpyObserver) {
        state.scrollSpyObserver = createScrollSpyObserver();
    }
    state.scrollSpyObserver.observe(sectionEl);
    requestActiveDocSectionUpdate();
}

export function setupScrollSpy() {
    state.activeDocSectionId = null;
    if (state.scrollSpyObserver) {
        state.scrollSpyObserver.disconnect();
    }
    state.scrollSpyObserver = createScrollSpyObserver();
    var content = document.getElementById('dynamic-content');
    if (!content) return;
    content.querySelectorAll('section[id]').forEach(function (sec) {
        state.scrollSpyObserver.observe(sec);
    });
    requestActiveDocSectionUpdate();
}

/**
 * Place top/bottom boundary sentinels in the docs content container and arm observers.
 */
export function setupInfiniteScroll() {
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

/**
 * Guarantee there is at least one section above and below the current section.
 */
export async function ensureDocsScrollRunway(sectionId, options = {}) {
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

export async function loadPreviousSection(options = {}) {
    if (!state.currentTab || state.docBoundaryPrevLoading) return false;

    var range = getLoadedDocSectionRange();
    if (!range || range.firstIndex <= 0) return false;

    var previousSectionId = range.orderedIds[range.firstIndex - 1];
    var anchorEl = getFirstLoadedSectionElement();
    var anchorTop = anchorEl ? anchorEl.getBoundingClientRect().top : null;

    state.docBoundaryPrevLoading = true;
    try {
        await loadSection(previousSectionId, false, {
            skipInfiniteRefresh: true,
            skipRunway: true
        });

        if (anchorEl && anchorEl.isConnected && anchorTop != null) {
            var nextTop = anchorEl.getBoundingClientRect().top;
            var delta = nextTop - anchorTop;
            if (Math.abs(delta) > 1) {
                markProgrammaticScroll();
                window.scrollTo({
                    top: (window.scrollY || window.pageYOffset || 0) + delta,
                    behavior: 'instant'
                });
            }
        }

        requestActiveDocSectionUpdate();
        prefetchDocNeighborsAround(state.activeDocSectionId || previousSectionId);
        return true;
    } finally {
        state.docBoundaryPrevLoading = false;
        if (!options.skipInfiniteRefresh) {
            setupInfiniteScroll();
        }
    }
}

export async function loadNextSection(options = {}) {
    if (!state.currentTab || state.docBoundaryNextLoading) return false;

    var range = getLoadedDocSectionRange();
    if (!range || range.lastIndex >= range.orderedIds.length - 1) return false;

    var nextSectionId = range.orderedIds[range.lastIndex + 1];

    state.docBoundaryNextLoading = true;
    try {
        await loadSection(nextSectionId, false, {
            skipInfiniteRefresh: true,
            skipRunway: true
        });
        requestActiveDocSectionUpdate();
        prefetchDocNeighborsAround(state.activeDocSectionId || nextSectionId);
        return true;
    } finally {
        state.docBoundaryNextLoading = false;
        if (!options.skipInfiniteRefresh) {
            setupInfiniteScroll();
        }
    }
}

export function leaveDocsView() {
    state.activeDocSectionId = null;
    state.scrollSpyTicking = false;
    releasePendingDocNavigation(0);
}
