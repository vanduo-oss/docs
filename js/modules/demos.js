import { setMorphBadgeContent } from './utils.js';

var hexGridInstance = null;
var hexGridDemoScope = null;

export function initHexGridDemo(scope) {
    var containerRoot = scope || document;
    var scopeToken = scope && scope.id ? scope.id : 'global';

    var demoContainer = (containerRoot && containerRoot.querySelector)
        ? containerRoot.querySelector('#hex-demo-container')
        : document.getElementById('hex-demo-container');
    var demoCanvas = (containerRoot && containerRoot.querySelector)
        ? containerRoot.querySelector('#hex-demo')
        : document.getElementById('hex-demo');

    if (!demoContainer || !demoCanvas) return;

    var isNewScope = hexGridDemoScope !== scopeToken
        || !hexGridInstance
        || !hexGridInstance.element
        || !hexGridInstance.element.isConnected
        || (hexGridInstance.element !== demoContainer);

    if (isNewScope && hexGridInstance) {
        hexGridInstance.destroy();
        hexGridInstance = null;
    }

    if (hexGridInstance) return;

    import('../hex-grid.js').then(function (module) {
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
        hexGridInstance = grid;
        hexGridDemoScope = scopeToken;

        var sizeValue = containerRoot.querySelector('#hex-size-value');
        var widthValue = containerRoot.querySelector('#hex-width-value');
        var heightValue = containerRoot.querySelector('#hex-height-value');
        var rotationValue = containerRoot.querySelector('#hex-rotation-value');
        var resetBtn = containerRoot.querySelector('#hex-reset-btn');
        var fillBtn = containerRoot.querySelector('#hex-fill-btn');
        var infoCard = containerRoot.querySelector('#hex-info-card');
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
                rotationValue.textContent = deg + 'deg';
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
                if (rotationValue) rotationValue.textContent = '0deg';
                grid.reset();
            });
        }
        if (fillBtn) {
            fillBtn.addEventListener('click', function () {
                grid.fillRandom();
            });
        }
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
        grid.on('zoom', function (data) {
            if (zoomLevelSpan) {
                var percent = Math.round(data.scale * 100);
                zoomLevelSpan.textContent = percent + '%';
            }
        });
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

var HERO_SUBTITLE_FADE_MS = 500;
var HERO_SUBTITLE_HOLD_MS = 2800;

export function cleanupHeroSubtitleRotate(root) {
    if (!root) return;
    root.querySelectorAll('[data-hero-subtitle]').forEach(function (el) {
        if (el._heroSubtitleInterval) {
            clearInterval(el._heroSubtitleInterval);
            el._heroSubtitleInterval = null;
        }
        el._heroSubtitleInit = false;
    });
}

export function initHeroSubtitleRotate(root) {
    if (!root) return;

    var container = root.querySelector('[data-hero-subtitle]');
    if (!container || container._heroSubtitleInit) return;

    var wordsAttr = container.getAttribute('data-hero-subtitle-words') || 'framework';
    var words = wordsAttr.split(',').map(function (w) { return w.trim(); }).filter(Boolean);
    if (words.length <= 1) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    container._heroSubtitleInit = true;
    container.innerHTML = '';

    words.forEach(function (word, index) {
        var span = document.createElement('span');
        span.className = 'hero-subtitle-word' + (index === 0 ? ' is-visible' : '');
        span.textContent = word;
        span.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
        container.appendChild(span);
    });

    var currentIndex = 0;
    var spans = container.querySelectorAll('.hero-subtitle-word');

    container._heroSubtitleInterval = setInterval(function () {
        var current = spans[currentIndex];
        var nextIndex = (currentIndex + 1) % words.length;
        var next = spans[nextIndex];

        current.classList.remove('is-visible');
        current.setAttribute('aria-hidden', 'true');
        next.classList.add('is-visible');
        next.setAttribute('aria-hidden', 'false');
        currentIndex = nextIndex;
    }, HERO_SUBTITLE_HOLD_MS + HERO_SUBTITLE_FADE_MS);
}

export function initSectionDemos(sectionEl) {
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
        var states = JSON.parse(badge.getAttribute('data-morph-states') || '[]');
        var classes = JSON.parse(badge.getAttribute('data-morph-classes') || '[]');
        var icons = JSON.parse(badge.getAttribute('data-morph-icons') || '[]');
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
                wave.style.top = ((e.clientY || rect.top + rect.height / 2) - rect.top) + 'px';
            }
            badge.classList.add('is-morphing');
            setTimeout(function () {
                badge.classList.remove('is-morphing');
                classes.forEach(function (c) { badge.classList.remove(c); });
                badge.classList.add(classes[nextIdx]);
                var current = badge.querySelector('.vd-morph-current');
                var nextEl = badge.querySelector('.vd-morph-next');
                if (current) setMorphBadgeContent(current, icons[nextIdx], states[nextIdx]);
                if (nextEl) setMorphBadgeContent(nextEl, icons[afterIdx], states[afterIdx]);
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

export function initMusicPlayerDemos(sectionEl) {
    var MP = window.VanduoMusicPlayer;
    if (!MP) return;

    var fixedPlayer = sectionEl.querySelector('#demo-detach-fixed');
    var btnDetachBl = sectionEl.querySelector('#btn-detach-bl');
    var btnDetachTr = sectionEl.querySelector('#btn-detach-tr');
    var btnAttachFixed = sectionEl.querySelector('#btn-attach-fixed');
    if (btnDetachBl && fixedPlayer) {
        btnDetachBl.addEventListener('click', function () { MP.detach(fixedPlayer, 'bottom-left'); });
    }
    if (btnDetachTr && fixedPlayer) {
        btnDetachTr.addEventListener('click', function () { MP.detach(fixedPlayer, 'top-right'); });
    }
    if (btnAttachFixed && fixedPlayer) {
        btnAttachFixed.addEventListener('click', function () { MP.attach(fixedPlayer); });
    }

    var dragPlayer = sectionEl.querySelector('#demo-detach-drag');
    var btnFloatPro = sectionEl.querySelector('#btn-float-pro');
    var btnFloatExpand = sectionEl.querySelector('#btn-float-expand');
    var btnFloatAttach = sectionEl.querySelector('#btn-float-attach');
    if (btnFloatPro && dragPlayer) {
        btnFloatPro.addEventListener('click', function () {
            MP.detach(dragPlayer, 'bottom-right');
            setTimeout(function () { MP.minimize(dragPlayer); }, 150);
        });
    }
    if (btnFloatExpand && dragPlayer) {
        btnFloatExpand.addEventListener('click', function () { MP.expand(dragPlayer); });
    }
    if (btnFloatAttach && dragPlayer) {
        btnFloatAttach.addEventListener('click', function () { MP.attach(dragPlayer); });
    }
}

export function initToastDemos(sectionEl) {
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
                    Toast.show({ title: 'With Title', message: 'This toast has a title and message.', type: 'info' });
                    break;
                case 'long-duration':
                    Toast.show({ message: 'This toast will stay for 10 seconds.', type: 'success', duration: 10000 });
                    break;
                case 'bottom-left':
                    Toast.show({ message: 'Bottom left position.', type: 'warning', position: 'bottom-left' });
                    break;
            }
        });
    });
}

export function applyTheme(theme) {
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

export function normalizeCustomizerFontKey(fontKey) {
    var key = String(fontKey || '').trim().toLowerCase();
    if (!key) return 'ubuntu';
    if (Object.prototype.hasOwnProperty.call(SUPPORTED_CUSTOMIZER_FONTS, key)) {
        return key;
    }
    return 'ubuntu';
}

export function applyCustomizerFontPreference(fontKey) {
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

var isFontSelectListenerInitialized = false;
export function initFontSelectListener() {
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

export function updateCustomizerDemoState() {
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
    if (!primary) primary = 'black';
    var neutral = html.getAttribute('data-neutral');
    if (!neutral && window.ThemeCustomizer && typeof window.ThemeCustomizer.getDefaultNeutral === 'function') {
        var themeMode = (window.ThemeCustomizer.state && window.ThemeCustomizer.state.theme)
            ? window.ThemeCustomizer.state.theme
            : 'system';
        neutral = window.ThemeCustomizer.getDefaultNeutral(themeMode);
    }
    if (!neutral) neutral = 'stone';
    var radius = html.getAttribute('data-radius') || '0.375';

    document.querySelectorAll('.theme-mode-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === theme);
    });
    document.querySelectorAll('.color-swatch').forEach(function (swatch) {
        swatch.classList.toggle('active', swatch.getAttribute('data-color') === primary);
    });
    document.querySelectorAll('.neutral-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-neutral') === neutral);
    });
    document.querySelectorAll('.radius-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-radius') === radius);
    });
    var fontSelect = document.querySelector('.font-select');
    if (fontSelect) {
        var font = normalizeCustomizerFontKey(html.getAttribute('data-font') || localStorage.getItem('vanduo-font-preference') || 'ubuntu');
        fontSelect.value = font;
    }
}

var isCustomizerDemoBootstrapped = false;
export function bootstrapCustomizerDemo() {
    if (isCustomizerDemoBootstrapped) return;
    isCustomizerDemoBootstrapped = true;
    initFontSelectListener();
    updateCustomizerDemoState();
}

export function initInteractiveDemos() {
    document.addEventListener('click', function (e) {
        if (e.target.closest('#make-draggable-btn')) {
            var el = document.querySelector('#programmatic-element');
            if (el && window.VanduoDraggable) {
                VanduoDraggable.makeDraggable(el, { data: 'programmatic-item' });
                el.textContent = 'I am now draggable!';
            }
        }
        if (e.target.closest('#remove-draggable-btn')) {
            var removableEl = document.querySelector('#programmatic-element');
            if (removableEl && window.VanduoDraggable) {
                VanduoDraggable.removeDraggable(removableEl);
                removableEl.textContent = "I'm not draggable yet...";
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

        var themeSwitcherBtn = e.target.closest('.theme-switcher-demo-btn');
        if (themeSwitcherBtn) {
            var theme = themeSwitcherBtn.getAttribute('data-theme-value');
            if (theme) {
                applyTheme(theme);
                var demoCard = themeSwitcherBtn.closest('.demo-card');
                if (demoCard) {
                    demoCard.querySelectorAll('.theme-switcher-demo-btn').forEach(function (btn) {
                        btn.classList.toggle('active', btn === themeSwitcherBtn);
                    });
                }
                var currentThemeLabel = document.getElementById('demo-current-theme');
                if (currentThemeLabel) {
                    currentThemeLabel.textContent = theme;
                }
            }
        }

        var themeModeBtn = e.target.closest('.theme-mode-btn');
        if (themeModeBtn) {
            var mode = themeModeBtn.getAttribute('data-mode');
            if (mode) {
                applyTheme(mode);
                updateCustomizerDemoState();
            }
        }

        var colorSwatch = e.target.closest('.color-swatch');
        if (colorSwatch) {
            var color = colorSwatch.getAttribute('data-color');
            if (color) {
                document.documentElement.setAttribute('data-primary', color);
                localStorage.setItem('vanduo-primary-color', color);
                updateCustomizerDemoState();
            }
        }

        var neutralBtn = e.target.closest('.neutral-btn');
        if (neutralBtn) {
            var neutral = neutralBtn.getAttribute('data-neutral');
            if (neutral) {
                document.documentElement.setAttribute('data-neutral', neutral);
                localStorage.setItem('vanduo-neutral-color', neutral);
                updateCustomizerDemoState();
            }
        }

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
}

export function initDraggableDropDemo() {
    document.addEventListener('draggable:drop', function (e) {
        if (e.target.id === 'demo-drop-zone') {
            e.target.appendChild(e.detail.element);
        }
    });
}
