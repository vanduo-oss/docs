import {
    SECTIONS_BASE,
    loadedSections,
    loadingSections,
    sectionPrefetching,
    state
} from './state.js';
import { extractDocsSectionId, withDocsContentVersion } from './utils.js';

export function findSectionMeta(sectionId) {
    for (var tabKey of Object.keys(state.registry.tabs)) {
        var tab = state.registry.tabs[tabKey];
        for (var cat of tab.categories) {
            var sec = cat.sections.find(function (s) { return s.id === sectionId; });
            if (sec) return { section: sec, category: cat.name, tab: tabKey };
        }
    }
    return null;
}

export function findPageMeta(pageId) {
    return state.registry.pages.find(function (p) { return p.id === pageId; }) || null;
}

export function getTabForSection(sectionId) {
    var meta = findSectionMeta(sectionId);
    return meta ? meta.tab : null;
}

export function getOrderedIds(tabKey) {
    var tab = state.registry.tabs[tabKey];
    if (!tab) return [];
    return tab.categories.flatMap(function (c) { return c.sections.map(function (s) { return s.id; }); });
}

export function parseSectionIdFromRoute(route) {
    if (typeof route !== 'string' || !route.startsWith('docs/')) return null;
    return extractDocsSectionId(route);
}

export function getCachedSectionHtml(sectionId) {
    if (!window.VanduoSectionCache || !sectionId) return null;
    return window.VanduoSectionCache.get(sectionId);
}

export function setCachedSectionHtml(sectionId, html) {
    if (!window.VanduoSectionCache || !sectionId || typeof html !== 'string') return;
    window.VanduoSectionCache.set(sectionId, html);
}

export async function prefetchSection(sectionId, options = {}) {
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

export async function loadRegistry() {
    var res = await fetch(withDocsContentVersion(SECTIONS_BASE + 'sections.json'), { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load sections.json');
    state.registry = await res.json();
}

export function getTotalSectionCount() {
    var totalSections = 0;
    Object.keys(state.registry.tabs).forEach(function (tabKey) {
        state.registry.tabs[tabKey].categories.forEach(function (cat) {
            totalSections += cat.sections.length;
        });
    });
    return totalSections;
}
