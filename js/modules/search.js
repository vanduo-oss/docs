import { state } from './state.js';
import { navigate } from './router.js';

var globalSearchIndex = [];
var globalSearchState = {
    isOpen: false,
    results: [],
    activeIndex: -1,
    query: '',
    debounceTimer: null
};

export function buildGlobalSearchIndex() {
    globalSearchIndex = [];

    Object.keys(state.registry.tabs).forEach(function (tabKey) {
        var tab = state.registry.tabs[tabKey];
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

export function globalSearch(query) {
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

        if (entry.category === 'Pages' && score > 0) score += 5;

        if (score > 0) {
            scored.push(Object.assign({ score: score }, entry));
        }
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 15);
}

export function globalSearchEscapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function globalSearchHighlight(text, query) {
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

function renderResultRows(results, query, indexAttr) {
    var html = '<ul class="global-search-results-list" role="listbox">';
    var lastCategory = '';
    var flatIndex = 0;
    results.forEach(function (r) {
        var groupLabel = r.tab + ' > ' + r.category;
        if (groupLabel !== lastCategory) {
            html += '<li class="global-search-category-label">' + globalSearchEscapeHtml(groupLabel) + '</li>';
            lastCategory = groupLabel;
        }
        var isActive = flatIndex === (indexAttr === 'data-index' ? globalSearchState.activeIndex : -1);
        html += '<li class="global-search-result' + (isActive ? ' is-active' : '') + '"'
            + ' role="option" ' + indexAttr + '="' + flatIndex + '"'
            + ' data-route="' + globalSearchEscapeHtml(r.route) + '"'
            + ' aria-selected="' + isActive + '">'
            + '<div class="global-search-result-icon"><i class="ph ' + globalSearchEscapeHtml(r.icon) + '"></i></div>'
            + '<div class="global-search-result-content">'
            + '<div class="global-search-result-title">' + globalSearchHighlight(r.title, query) + '</div>'
            + '<div class="global-search-result-meta">' + globalSearchEscapeHtml(r.category) + '</div>'
            + '</div></li>';
        flatIndex++;
    });
    html += '</ul>';
    return html;
}

export function renderGlobalSearchResults() {
    var container = document.getElementById('global-search-results');
    if (!container) return;
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

    container.innerHTML = renderResultRows(globalSearchState.results, globalSearchState.query, 'data-index');
}

export function openGlobalSearch() {
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

export function closeGlobalSearch() {
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

export function initGlobalSearch() {
    buildGlobalSearchIndex();

    var trigger = document.getElementById('global-search-trigger');
    if (trigger) {
        trigger.addEventListener('click', function () { openGlobalSearch(); });
    }

    var overlay = document.getElementById('global-search-overlay');
    var modalInput = document.getElementById('global-search-input');
    var results = document.getElementById('global-search-results');
    if (!overlay || !modalInput || !results) return;

    overlay.addEventListener('click', function () {
        closeGlobalSearch();
    });

    modalInput.addEventListener('input', function () {
        if (globalSearchState.debounceTimer) clearTimeout(globalSearchState.debounceTimer);
        globalSearchState.debounceTimer = setTimeout(function () {
            globalSearchState.query = modalInput.value.trim();
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

    modalInput.addEventListener('keydown', function (e) {
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

    results.addEventListener('click', function (e) {
        var item = e.target.closest('.global-search-result');
        if (item) {
            var idx = parseInt(item.dataset.index, 10);
            selectGlobalSearchResult(idx);
        }
    });

    document.addEventListener('keydown', function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            e.stopPropagation();

            var heroInput = document.getElementById('hero-search-input');
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

    initHeroSearch();
}

function initHeroSearch() {
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
        if (heroSearchState.results.length === 0 && heroSearchState.query.length >= 2) {
            dropdown.innerHTML = '<div class="hero-dropdown-hint">'
                + '<div class="hero-dropdown-hint-icon"><i class="ph ph-magnifying-glass"></i></div>'
                + '<div class="hero-dropdown-hint-text">No results found</div></div>';
            return;
        }
        if (heroSearchState.results.length === 0) {
            dropdown.innerHTML = '<div class="hero-dropdown-hint">'
                + '<div class="hero-dropdown-hint-icon"><i class="ph ph-magnifying-glass"></i></div>'
                + '<div class="hero-dropdown-hint-text">Type to search documentation, components and guides</div></div>';
            return;
        }

        var html = renderResultRows(heroSearchState.results, heroSearchState.query, 'data-hero-index');
        html += '<div class="hero-search-dropdown-footer">'
            + '<span><kbd>up</kbd><kbd>down</kbd> navigate</span>'
            + '<span><kbd>enter</kbd> select</span>'
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

    document.addEventListener('focusin', function (e) {
        if (!e.target || e.target.id !== 'hero-search-input') return;
        renderHeroDropdownResults();
        openHeroDropdown();
    });

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

    document.addEventListener('click', function (e) {
        var item = e.target.closest('[data-hero-index]');
        if (item && item.closest('.hero-search-dropdown')) {
            var idx = parseInt(item.dataset.heroIndex, 10);
            selectHeroResult(idx);
            return;
        }
        if (heroSearchState.isOpen && !e.target.closest('.hero-search-wrapper')) {
            closeHeroDropdown();
        }
    });
}
