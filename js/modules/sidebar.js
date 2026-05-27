import { state } from './state.js';
import { getOrderedIds } from './registry.js';

var toggleMorphing = false;
var pendingDocModeTab = null;

export function buildSidebar(tabKey) {
    var navList = document.getElementById('dynamic-nav-list');
    if (!navList) return;
    navList.innerHTML = '';

    var searchInput = document.getElementById('doc-sidebar-filter-input');
    if (searchInput) { searchInput.value = ''; }

    var tab = state.registry.tabs[tabKey];
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

export function filterSidebarNav(query) {
    var navList = document.getElementById('dynamic-nav-list');
    if (!navList) return;
    var q = query.trim().toLowerCase();

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

export function clearNavigatingNavLinks() {
    document.querySelectorAll('.doc-nav-link.is-navigating').forEach(function (link) {
        link.classList.remove('is-navigating');
    });
}

function getMorphDurationMs(el) {
    var duration = 750;
    if (!el) return duration;
    var custom = getComputedStyle(el).getPropertyValue('--vd-morph-duration');
    if (custom) {
        var parsed = parseFloat(custom);
        if (!isNaN(parsed)) duration = parsed * (custom.indexOf('ms') !== -1 ? 1 : 1000);
    }
    return duration;
}

function setToggleContent(el, tabKey) {
    var isGuides = tabKey === 'guides';
    var icon = el.querySelector('.doc-water-icon');
    var label = el.querySelector('.doc-water-label');
    if (icon) icon.className = isGuides ? 'doc-water-icon ph ph-compass' : 'doc-water-icon ph ph-cube';
    if (label) label.textContent = isGuides ? 'Guides' : 'Components';
}

function getToggleActionLabel(tabKey) {
    return tabKey === 'guides' ? 'Switch to Components' : 'Switch to Guides';
}

function getToggleTooltipText(tabKey) {
    return tabKey === 'guides' ? 'Click for Components' : 'Click for Guides';
}

function orderDocWaterToggleLayers(toggle) {
    if (!toggle) return;
    var current = toggle.querySelector('.vd-morph-current');
    var next = toggle.querySelector('.vd-morph-next');
    if (!current || !next) return;
    if (current.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_PRECEDING) {
        toggle.insertBefore(current, next);
    }
}

export function setActiveDocMode(tabKey) {
    var toggle = document.getElementById('doc-water-toggle');
    if (!toggle) return;

    var isGuides = tabKey === 'guides';
    toggle.setAttribute('aria-pressed', String(isGuides));
    toggle.setAttribute('aria-label', getToggleActionLabel(tabKey));
    var tooltipText = getToggleTooltipText(tabKey);
    toggle.setAttribute('data-tooltip', tooltipText);
    if (window.VanduoTooltips && typeof window.VanduoTooltips.update === 'function') {
        window.VanduoTooltips.update(toggle, tooltipText);
    }

    if (toggleMorphing) {
        pendingDocModeTab = tabKey;
        return;
    }
    pendingDocModeTab = null;

    var current = toggle.querySelector('.vd-morph-current');
    var next = toggle.querySelector('.vd-morph-next');
    var oppositeTab = isGuides ? 'components' : 'guides';
    if (current) setToggleContent(current, tabKey);
    if (next) setToggleContent(next, oppositeTab);
    orderDocWaterToggleLayers(toggle);
}

export function setActiveNavbarLink(route) {
    document.querySelectorAll('.vd-navbar-nav .vd-nav-link').forEach(function (link) {
        var r = link.getAttribute('data-route');
        if (route === 'docs') {
            link.classList.toggle('active', r === 'docs');
        } else {
            link.classList.toggle('active', r === route);
        }
    });
}

/**
 * Update the sidebar to highlight the given section as active. Removes
 * the `.active` class from all links and applies it to the matching one.
 * Also expands the parent group if the section is nested.
 * @param {string} sectionId - section to mark active.
 */
export function setActiveNavLink(sectionId) {
    document.querySelectorAll('.doc-nav-link').forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('data-section') === sectionId);
    });
}

export function syncDocsTabState(tabKey) {
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

export function closeMobileToc() {
    var sidebarToggle = document.querySelector('.doc-sidebar-toggle');
    var sidebarNav = document.querySelector('.doc-nav');
    if (sidebarToggle && sidebarNav) {
        sidebarNav.classList.remove('is-open');
        sidebarToggle.classList.remove('is-open');
        sidebarToggle.setAttribute('aria-expanded', 'false');
    }
}

export function initMobileToc() {
    var sidebarToggle = document.querySelector('.doc-sidebar-toggle');
    var sidebarNav = document.querySelector('.doc-nav');
    if (sidebarToggle && sidebarNav) {
        sidebarToggle.addEventListener('click', function () {
            var isOpen = sidebarNav.classList.toggle('is-open');
            sidebarToggle.classList.toggle('is-open', isOpen);
            sidebarToggle.setAttribute('aria-expanded', String(isOpen));
        });
    }
}

export function initSidebarNavEvents(navigateFn) {
    var dynamicNavList = document.getElementById('dynamic-nav-list');
    if (!dynamicNavList) return;
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
        navigateFn('docs/' + id);
    });
}

export function initSidebarFilterEvents() {
    var docSidebarFilterInput = document.getElementById('doc-sidebar-filter-input');
    if (!docSidebarFilterInput) return;

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

export function initDocModeToggle(navigateFn) {
    var docWaterToggle = document.getElementById('doc-water-toggle');
    if (!docWaterToggle) return;

    docWaterToggle.addEventListener('click', function () {
        if (toggleMorphing) return;

        var toggle = this;
        var hash = String(location.hash || '');
        var activeTab = state.currentTab || (hash.indexOf('docs/guides') !== -1 ? 'guides' : 'components');
        var destTab = activeTab === 'guides' ? 'components' : 'guides';

        var next = toggle.querySelector('.vd-morph-next');
        if (next) setToggleContent(next, destTab);

        toggleMorphing = true;
        pendingDocModeTab = destTab;

        var tabRoutes = { components: 'docs/components', guides: 'docs/guides' };
        navigateFn(tabRoutes[destTab] || 'docs/components');

        var morphDuration = getMorphDurationMs(toggle);
        function finalizeWhenMorphSettles() {
            if (toggle.classList.contains('is-morphing')) {
                requestAnimationFrame(finalizeWhenMorphSettles);
                return;
            }
            toggleMorphing = false;
            var finalTab = pendingDocModeTab || state.currentTab || destTab;
            setActiveDocMode(finalTab);
        }

        setTimeout(function () {
            requestAnimationFrame(finalizeWhenMorphSettles);
        }, morphDuration);
    }, true);
}

export function getCurrentDocOrderedIds() {
    return state.currentTab ? getOrderedIds(state.currentTab) : [];
}
