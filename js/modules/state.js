export const SECTIONS_BASE = './sections/';
export const DOCS_CONTENT_VERSION = '1.4.3-docs-1';

export const loadedSections = new Set();
export const loadingSections = new Set();
export const sectionPrefetching = new Set();

export const state = {
    registry: { pages: [], tabs: {} },
    scrollSpyObserver: null,
    docTopBoundaryObserver: null,
    docBottomBoundaryObserver: null,
    docTopBoundaryEl: null,
    docBottomBoundaryEl: null,
    currentView: null,
    currentTab: null,
    scrollSpyTicking: false,
    activeDocSectionId: null,
    pendingDocNavigationId: null,
    pendingDocNavigationReleaseTimer: null,
    docScrollLoaderEl: null,
    docScrollLoaderTargetId: null,
    docScrollLoaderFallbackTimer: null,
    requestedDocScrollLoaderSectionId: null,
    currentNavigationController: null,
    docTopBoundaryArmed: false,
    docBottomBoundaryArmed: false,
    docBoundaryPrevLoading: false,
    docBoundaryNextLoading: false,
    docLastKnownScrollY: window.scrollY || window.pageYOffset || 0,
    docContentEpoch: 0,
    docNavigationSettleGeneration: 0,
    docProgrammaticScroll: false,
    docProgrammaticScrollTimer: null,
    docExplicitNavCooldownUntil: 0,
    docExplicitNavSectionId: null,
    docPendingNavigationStartedAt: 0,
    docNavSuppressBoundaryScroll: false
};

export const DOC_USER_SCROLL_CANCEL_THRESHOLD = 8;
export const DOC_EXPLICIT_NAV_COOLDOWN_MS = 1500;
export const DOC_TOP_BOUNDARY_SENTINEL_ID = 'docs-scroll-top-sentinel';
export const DOC_BOTTOM_BOUNDARY_SENTINEL_ID = 'infinite-scroll-sentinel';
export const DOC_BOUNDARY_ROOT_MARGIN = '400px 0px 400px 0px';
export const DOC_NEIGHBOR_PREFETCH_RADIUS = 1;
export const DOC_RUNWAY_BOTTOM_THRESHOLD = 48;
export const SCROLL_SPY_OFFSET = 96;
export const ACTIVE_DOC_SECTION_TOLERANCE = 24;
