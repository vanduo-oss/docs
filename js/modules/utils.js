import { DOCS_CONTENT_VERSION } from './state.js';

export function hideDisabledCodeTabs(container) {
    if (!container) return;
    container.querySelectorAll('.vd-code-snippet-tab[disabled]').forEach(function (tab) {
        tab.style.display = 'none';
    });
}

/**
 * Safely inject HTML from section files into the DOM. Parses with DOMParser,
 * walks the tree to strip dangerous elements (script, iframe, object, embed,
 * on* attributes), then appends sanitized nodes to the container.
 * @param {HTMLElement} container - target element to receive the HTML.
 * @param {string} html - raw HTML string from the section file.
 */
export function safeInjectHtml(container, html) {
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

export function initVanduoScope(root) {
    if (window.Vanduo && typeof window.Vanduo.init === 'function') {
        window.Vanduo.init(root || document);
    }
}

export function destroyVanduoScope(root) {
    if (window.Vanduo && typeof window.Vanduo.destroy === 'function' && root) {
        window.Vanduo.destroy(root);
    }
}

export function setMorphBadgeContent(target, icon, label) {
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

export function withDocsContentVersion(url) {
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(DOCS_CONTENT_VERSION);
}

export function setDocumentTitle(title) {
    var baseTitle = 'Vanduo Framework';
    if (title === 'Home') {
        document.title = baseTitle;
    } else if (title) {
        document.title = title + ' - ' + baseTitle;
    } else {
        document.title = baseTitle;
    }
}

export function extractDocsSectionId(value) {
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

export function wireRouteLinks(container, navigateFn) {
    if (!container || typeof navigateFn !== 'function') return;
    container.querySelectorAll('[data-route]').forEach(function (el) {
        if (el._routeWired) return;
        el._routeWired = true;
        el.addEventListener('click', function (e) {
            e.preventDefault();
            var route = el.getAttribute('data-route');
            navigateFn(route);
        });
    });
}
