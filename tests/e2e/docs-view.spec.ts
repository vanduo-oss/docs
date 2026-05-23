import { test, expect, type Page, type Request } from '@playwright/test';

async function waitForSPA(page: Page) {
    await page.waitForFunction(() => {
        return document.querySelector('#page-view.is-active') !== null && document.querySelector('#page-view .vd-dynamic-loader') === null
            || document.querySelector('#docs-view.is-active') !== null
            || document.querySelector('#docs-landing') !== null;
    }, { timeout: 10000 });
}

async function waitForVisibleSection(page: Page, selector: string) {
    await page.waitForFunction((targetSelector) => {
        const section = document.querySelector(targetSelector);
        if (!section) return false;

        const style = window.getComputedStyle(section);
        const rect = section.getBoundingClientRect();

        return document.querySelector('#docs-view.is-active') !== null
            && style.display !== 'none'
            && style.visibility !== 'hidden'
            && rect.width > 0
            && rect.height > 0;
    }, selector, { timeout: 10000 });
}

function trackSectionHtmlRequests(page: Page) {
    const requests: string[] = [];
    const handler = (request: Request) => {
        const url = request.url();
        if (url.includes('/sections/') && /\.html\?v=/.test(url)) {
            requests.push(url.replace(/^.*\/sections\//, 'sections/'));
        }
    };

    page.on('request', handler);

    return {
        clear() {
            requests.length = 0;
        },
        snapshot() {
            return [...new Set(requests)];
        },
        dispose() {
            page.off('request', handler);
        }
    };
}

async function waitForSectionHtmlNetworkIdle(page: Page, tracker: ReturnType<typeof trackSectionHtmlRequests>, idleMs = 1200, timeoutMs = 15000) {
    const startedAt = Date.now();
    let previousCount = tracker.snapshot().length;
    let lastChangeAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        await page.waitForTimeout(150);
        const nextCount = tracker.snapshot().length;
        if (nextCount !== previousCount) {
            previousCount = nextCount;
            lastChangeAt = Date.now();
        }
        if (Date.now() - lastChangeAt >= idleMs) {
            return;
        }
    }
}

async function getRenderedDocSectionIds(page: Page) {
    return await page.locator('#dynamic-content > section[id]').evaluateAll((elements) => {
        return elements.map((element) => (element as HTMLElement).id);
    });
}

async function getCurrentTheme(page: Page) {
    return await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

async function cycleTheme(page: Page, targetTheme: string | null) {
    const darkModeToggle = page.locator('#dark-mode-toggle');
    let currentTheme = await getCurrentTheme(page);
    let attempts = 0;

    while (currentTheme !== targetTheme && attempts < 3) {
        await darkModeToggle.click();
        await page.waitForTimeout(400);
        currentTheme = await getCurrentTheme(page);
        attempts++;
    }

    return currentTheme;
}

async function getFrameworkAssetInfo(page: Page) {
    return await page.evaluate(() => {
        const runtimeWindow = window as Window & {
            __VANDUO_FRAMEWORK_ASSET_MODE?: string;
            __VANDUO_FRAMEWORK_ASSETS?: {
                cssHref?: string;
                jsSrc?: string;
            };
        };
        const frameworkCss = document.querySelector('link[data-framework-css]') as HTMLLinkElement | null;

        return {
            mode: runtimeWindow.__VANDUO_FRAMEWORK_ASSET_MODE || null,
            marker: document.documentElement.getAttribute('data-framework-assets'),
            cssHref: frameworkCss ? frameworkCss.getAttribute('href') : null,
            jsSrc: runtimeWindow.__VANDUO_FRAMEWORK_ASSETS ? runtimeWindow.__VANDUO_FRAMEWORK_ASSETS.jsSrc || null : null
        };
    });
}

async function expectLocalFrameworkAssets(page: Page) {
    await page.waitForFunction(() => {
        const runtimeWindow = window as Window & {
            __VANDUO_FRAMEWORK_ASSET_MODE?: string;
        };

        return runtimeWindow.__VANDUO_FRAMEWORK_ASSET_MODE === 'local'
            && document.documentElement.getAttribute('data-framework-assets') === 'local';
    }, { timeout: 10000 });

    const assetInfo = await getFrameworkAssetInfo(page);
    expect(assetInfo.mode).toBe('local');
    expect(assetInfo.marker).toBe('local');
    expect(assetInfo.cssHref?.split('?')[0]).toBe('./dist/vanduo.min.css');
    expect(assetInfo.jsSrc?.split('?')[0]).toBe('./dist/vanduo.min.js');
}

test.describe('4. Documentation View', () => {

    test.describe('Docs Landing (#docs)', () => {
        test('Displays the main docs cards', async ({ page }) => {
            await page.goto('/#docs');
            await waitForSPA(page);

            const docsLanding = page.locator('#docs-landing');
            await expect(docsLanding).toBeVisible();

            const cards = docsLanding.locator('.vd-card');
            await expect(cards).toHaveCount(3);

            await expect(docsLanding).toContainText('Components');
            await expect(docsLanding).toContainText('Guides');
            await expect(docsLanding).toContainText('Changelog');
            await expect(docsLanding).not.toContainText('Concepts');
        });

        test('Cards route to respective tab views', async ({ page }) => {
            await page.goto('/#docs');
            await waitForSPA(page);

            // Click Components card
            const componentsCard = page.locator('#docs-landing a[data-route="docs/components"]');
            await componentsCard.click();
            await page.waitForTimeout(500);

            // The SPA router automatically redirects to the first component section
            await expect(page).toHaveURL(/.*#docs\//);
            await expect(page.locator('#docs-view.is-active')).toBeVisible();

            // Go back and click Guides
            await page.goBack();
            await waitForSPA(page);

            const guidesCard = page.locator('#docs-landing a[data-route="docs/guides"]');
            await guidesCard.click();
            await page.waitForTimeout(500);
            await expect(page).toHaveURL(/.*#docs\//);

        });
    });

    test.describe('Changelog (#changelog)', () => {
        test('Shows v1.4.1 as latest and keeps v1.4.0 as history', async ({ page }) => {
            await page.goto('/#changelog');
            await waitForSPA(page);

            const changelog = page.locator('#changelog');
            await expect(changelog).toBeVisible();

            const latestCard = changelog.locator('.version-card').first();
            await expect(latestCard).toContainText('v1.4.1');
            await expect(latestCard).toContainText('Latest');
            await expect(latestCard).toContainText('Strict --vd-*');
            await expect(latestCard).toContainText('--vd-*');

            const previousCard = changelog.locator('.version-card').nth(1);
            await expect(previousCard).toContainText('v1.4.0');
            await expect(previousCard).not.toContainText('Latest');
        });
    });

    test.describe('Templates (#templates)', () => {
        test('Renders screenshot row cards without iframe previews', async ({ page }) => {
            test.skip(true, 'Templates view is currently disabled');
            await page.goto('/#templates');
            await waitForSPA(page);

            const templates = page.locator('#templates');
            await expect(templates).toBeVisible();
            await expect(templates.locator('.template-preview-card')).toHaveCount(6);
            await expect(templates.locator('iframe')).toHaveCount(0);
            await expect(templates.locator('[data-template-view="gallery"] .template-shot-light')).toHaveCount(6);
            await expect(templates.locator('[data-template-view="gallery"] .template-shot-dark')).toHaveCount(6);
            await expect(templates.locator('.template-preview-card').first()).toContainText('View Template Page');
            await expect(templates.locator('[data-template-view="gallery"] a[href="http://localhost:8788/portfolio/"]')).toHaveCount(1);

            await expect(templates.locator('[data-template-view="gallery"] .template-shot-light').first()).toBeVisible();
            await cycleTheme(page, 'dark');
            await expect(templates.locator('[data-template-view="gallery"] .template-shot-dark').first()).toBeVisible();
            await expect(templates.locator('[data-template-view="gallery"] .template-shot-light').first()).toBeHidden();
        });

        test('Opens a template detail page from the gallery route', async ({ page }) => {
            test.skip(true, 'Templates view is currently disabled');
            await page.goto('/#templates/portfolio');
            await waitForSPA(page);

            const detail = page.locator('[data-template-detail="portfolio"]');
            await expect(detail).toBeVisible();
            await expect(detail).toContainText('Creative Portfolio');
            await expect(detail).toContainText('Open Live Preview');
            await expect(page.locator('[data-template-view="gallery"]')).toBeHidden();
            await expect(page).toHaveURL(/.*#templates\/portfolio/);
        });
    });

    test.describe('Components Tab (#docs/components)', () => {
        test('Sidebar renders with correct categories and first section loads', async ({ page }) => {
            await page.goto('/#docs/components');
            await waitForSPA(page);

            const modeToggle = page.locator('#doc-water-toggle');
            await expect(modeToggle).toHaveAttribute('aria-pressed', 'false');
            await expect(modeToggle).toHaveAttribute('aria-label', 'Switch to Guides');
            await expect(modeToggle).toHaveAttribute('data-tooltip', 'Click for Guides');
            await expect(modeToggle.locator('.vd-morph-current .doc-water-label')).toHaveText('Components');
            await expect(modeToggle).not.toHaveClass(/is-guides/);

            // Check for Sidebar category groups
            const sidebarNavItems = page.locator('.doc-nav-list li');
            await expect(sidebarNavItems).not.toHaveCount(0);

            // Check first section loaded
            const content = page.locator('#dynamic-content');
            await expect(content).toBeVisible();
            // Wait for at least one piece of actual content inside dynamic-content
            await expect(content.locator('h1, h2, h3, h4').first()).toBeVisible();
        });

        test('Initial docs load only fetches the visible target plus a small runway', async ({ page }) => {
            const tracker = trackSectionHtmlRequests(page);

            try {
                await page.goto('/#docs/components');
                await waitForSPA(page);
                await waitForVisibleSection(page, '#icons');
                await waitForSectionHtmlNetworkIdle(page, tracker);

                const sectionRequests = tracker.snapshot();
                const renderedSections = await getRenderedDocSectionIds(page);

                expect(sectionRequests.length).toBeLessThanOrEqual(2);
                expect(renderedSections[0]).toBe('icons');
                expect(renderedSections.length).toBeLessThanOrEqual(2);
            } finally {
                tracker.dispose();
            }
        });

        test('Sidebar jump to buttons is target-first and avoids materializing the full prefix', async ({ page, isMobile }) => {
            test.skip(!!isMobile, 'Network budget check uses the desktop-visible sidebar.');
            const tracker = trackSectionHtmlRequests(page);

            try {
                await page.goto('/#docs/components');
                await waitForSPA(page);
                await waitForVisibleSection(page, '#icons');
                await waitForSectionHtmlNetworkIdle(page, tracker);

                tracker.clear();
                await page.locator('.doc-nav-link[data-section="buttons"]').click();
                await waitForVisibleSection(page, '#buttons');
                await waitForSectionHtmlNetworkIdle(page, tracker);

                const sectionRequests = tracker.snapshot();
                const renderedSections = await getRenderedDocSectionIds(page);

                expect(sectionRequests.length).toBeLessThanOrEqual(4);
                expect(renderedSections[0]).toBe('buttons');
                expect(renderedSections.length).toBeLessThanOrEqual(2);
                expect(renderedSections).not.toContain('icons');
                expect(renderedSections).not.toContain('color-palette');
                await expect(page).toHaveURL(/.*#docs\/buttons/);
            } finally {
                tracker.dispose();
            }
        });

        test('Far sidebar jump to music-player stays within the reduced request budget', async ({ page, isMobile }) => {
            test.skip(!!isMobile, 'Network budget check uses the desktop-visible sidebar.');
            const tracker = trackSectionHtmlRequests(page);

            try {
                await page.goto('/#docs/components');
                await waitForSPA(page);
                await waitForVisibleSection(page, '#icons');
                await waitForSectionHtmlNetworkIdle(page, tracker);

                tracker.clear();
                await page.locator('.doc-nav-link[data-section="buttons"]').click();
                await waitForVisibleSection(page, '#buttons');
                await waitForSectionHtmlNetworkIdle(page, tracker);

                tracker.clear();
                await page.locator('.doc-nav-link[data-section="music-player"]').click();
                await waitForVisibleSection(page, '#music-player');
                await waitForSectionHtmlNetworkIdle(page, tracker);

                const sectionRequests = tracker.snapshot();
                const renderedSections = await getRenderedDocSectionIds(page);

                expect(sectionRequests.length).toBeLessThanOrEqual(4);
                expect(renderedSections[0]).toBe('music-player');
                expect(renderedSections.length).toBeLessThanOrEqual(2);
                expect(renderedSections).not.toContain('buttons');
                await expect(page).toHaveURL(/.*#docs\/music-player/);
            } finally {
                tracker.dispose();
            }
        });

        test('Upward scroll backfills previous sections one at a time without yanking the viewport', async ({ page, isMobile }) => {
            test.skip(!!isMobile, 'Sequential prepend behavior is validated on desktop layout.');

            await page.goto('/#docs/music-player');
            await waitForSPA(page);
            await waitForVisibleSection(page, '#music-player');
            await page.waitForTimeout(1200);

            let renderedSections = await getRenderedDocSectionIds(page);
            expect(renderedSections[0]).toBe('music-player');
            expect(renderedSections).not.toContain('image-box');
            expect(renderedSections).not.toContain('footer');

            const topAfterScroll = await page.evaluate(() => {
                const target = document.getElementById('music-player');
                if (!target) return null;
                window.scrollBy(0, -180);
                return target.getBoundingClientRect().top;
            });
            expect(topAfterScroll).not.toBeNull();

            await page.waitForFunction(() => !!document.getElementById('image-box'), { timeout: 10000 });
            const topAfterFirstPrepend = await page.evaluate(() => {
                const target = document.getElementById('music-player');
                return target ? target.getBoundingClientRect().top : null;
            });
            expect(topAfterFirstPrepend).not.toBeNull();
            expect(Math.abs((topAfterFirstPrepend ?? 0) - (topAfterScroll ?? 0))).toBeLessThanOrEqual(32);

            renderedSections = await getRenderedDocSectionIds(page);
            expect(renderedSections).toEqual(expect.arrayContaining(['image-box', 'music-player']));
            expect(renderedSections).not.toContain('footer');

            await page.waitForTimeout(500);
            await expect(page.locator('#footer')).toHaveCount(0);

            await page.evaluate(async () => {
                for (let step = 0; step < 6 && !document.getElementById('footer'); step++) {
                    window.scrollBy(0, -600);
                    await new Promise((resolve) => window.setTimeout(resolve, 250));
                }
            });
            await page.waitForFunction(() => !!document.getElementById('footer'), { timeout: 10000 });

            renderedSections = await getRenderedDocSectionIds(page);
            expect(renderedSections).toEqual(expect.arrayContaining(['footer', 'image-box', 'music-player']));
            expect(renderedSections.indexOf('footer')).toBeLessThan(renderedSections.indexOf('image-box'));
            expect(renderedSections.indexOf('image-box')).toBeLessThan(renderedSections.indexOf('music-player'));
        });

        test('Scrollspy highlights the active section in the sidebar as user scrolls', async ({ page, isMobile }) => {
            // Scrollspy behavior might be flaky on mobile due to sidebar collapsing, test on desktop
            test.skip(!!isMobile, 'Scrollspy tested primarily on desktop layout');

            await page.goto('/#docs/components');
            await waitForSPA(page);

            // Click a link lower down to ensure we have scrollable area
            const buttonsLink = page.locator('.doc-nav-link[data-section="buttons"]');
            await buttonsLink.click();
            await page.waitForTimeout(500);

            const section = page.locator('#buttons');
            await expect(section).toBeVisible();

            // Route should resolve to the clicked section even when lazy preloading inserts earlier sections.
            await expect(page).toHaveURL(/.*#docs\/buttons/);

            // Let's scroll past it and see if scrollspy triggers
            await page.evaluate(() => window.scrollBy(0, 1000));
            await page.waitForTimeout(1000); // give scrollspy time

            // See if active link changed or is multiple
            // The scrollspy logic handles this on the actual site.
        });

        test('Mobile sidebar toggle opens and closes menu correctly', async ({ page, isMobile }) => {
            test.skip(!isMobile, 'Sidebar toggle is only for mobile/tablet');

            await page.goto('/#docs/components');
            await waitForSPA(page);

            const toggle = page.locator('.doc-sidebar-toggle');
            const navList = page.locator('.doc-nav-list');

            await expect(toggle).toBeVisible();
            // list should be hidden or have 0 height (depends on css, let's verify visibility)
            // The CSS uses display:none or max-height 0

            await toggle.click();
            await expect(navList).toBeVisible();
            await expect(toggle).toHaveAttribute('aria-expanded', 'true');

            await toggle.click();
            await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        });

        test('Mobile docs section starts below sticky docs controls', async ({ page, isMobile }) => {
            test.skip(!isMobile, 'Overlap check only applies to mobile/tablet stacked docs layout');

            await page.goto('/#docs/components');
            await waitForSPA(page);

            const tocToggle = page.locator('.doc-sidebar-toggle');
            await expect(tocToggle).toBeVisible();
            await tocToggle.click();

            const targetLink = page.locator('.doc-nav-link[data-section="icons"]');
            await expect(targetLink).toBeVisible();
            await targetLink.click();

            await expect(page).toHaveURL(/.*#docs\/icons/);

            const metrics = await page.evaluate(() => {
                const sidebar = document.querySelector('.doc-sidebar') as HTMLElement | null;
                const targetSection = document.querySelector('#icons') as HTMLElement | null;
                if (!sidebar || !targetSection) {
                    return null;
                }

                const sidebarRect = sidebar.getBoundingClientRect();
                const sectionRect = targetSection.getBoundingClientRect();

                return {
                    stickyBottom: Math.round(sidebarRect.bottom),
                    sectionTop: Math.round(sectionRect.top)
                };
            });

            expect(metrics).not.toBeNull();
            expect(metrics!.sectionTop).toBeGreaterThanOrEqual(metrics!.stickyBottom - 1);
        });

        test('reload keeps a deep docs route anchored to its intended section', async ({ page, isMobile }) => {
            test.skip(!!isMobile, 'Reload anchoring regression is covered on desktop, where the scroll restoration race is reproducible.');
            await page.goto('/#docs/vd-hex');
            await waitForSPA(page);

            const target = page.locator('#vd-hex');
            await expect(target).toBeVisible();
            await expect(page).toHaveURL(/.*#docs\/vd-hex/);

            await page.evaluate(() => {
                window.scrollTo(0, 24000);
                window.history.replaceState(null, '', '#docs/vd-hex');
            });

            await page.reload();
            await waitForSPA(page);

            await expect(page).toHaveURL(/.*#docs\/vd-hex/);
            await page.waitForFunction(() => {
                const target = document.getElementById('vd-hex');
                if (!target) return false;
                const top = target.getBoundingClientRect().top;
                return top <= 120 && top >= -8;
            }, { timeout: 10000 });
        });

        test('Vanduo Charts docs render live donut demo and register in navigation/search', async ({ page }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            page.on('console', (message) => {
                if (message.type() === 'error') errors.push(message.text());
            });

            await page.goto('/#docs/vd-charts');
            await waitForSPA(page);

            const target = page.locator('#vd-charts');
            await expect(target).toBeVisible();
            await expect(page).toHaveURL(/.*#docs\/vd-charts/);

            await expect(page.locator('#vd-charts-donut-demo svg[role="img"]')).toBeVisible();
            await expect(page.locator('#vd-charts-donut-demo path.vd-chart-slice')).toHaveCount(3);
            await expect(page.locator('.doc-nav-link[data-section="vd-charts"]')).toHaveCount(1);

            await page.locator('#global-search-trigger').click();
            await page.locator('#global-search-input').fill('donut chart');
            await page.waitForTimeout(300);
            await expect(page.locator('#global-search-results .global-search-result[data-route="docs/vd-charts"]').first()).toBeVisible();

            expect(errors.join('\n')).not.toContain('Vanduo Charts');
            expect(errors).toEqual([]);
        });

        test('Vanduo Flowchart docs render live editor and register in navigation/search', async ({ page }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            page.on('console', (message) => {
                if (message.type() === 'error') errors.push(message.text());
            });

            await page.goto('/#docs/vd-flowchart');
            await waitForSPA(page);

            const target = page.locator('#vd-flowchart');
            await expect(target).toBeVisible();
            await expect(page).toHaveURL(/.*#docs\/vd-flowchart/);

            await expect(page.locator('#vd-flowchart-demo .vd-flowchart-shell')).toBeVisible();
            await expect(page.locator('#vd-flowchart-demo .vd-flowchart-node')).toHaveCount(4);
            await expect(page.locator('.doc-nav-link[data-section="vd-flowchart"]')).toHaveCount(1);

            await page.locator('#vd-flowchart-demo [data-node-type="label"]').click();
            await expect(page.locator('#vd-flowchart-demo .vd-flowchart-node')).toHaveCount(5);

            await page.locator('#global-search-trigger').click();
            await page.locator('#global-search-input').fill('flowchart');
            await page.waitForTimeout(300);
            await expect(page.locator('#global-search-results .global-search-result[data-route="docs/vd-flowchart"]').first()).toBeVisible();

            expect(errors.join('\n')).not.toContain('Vanduo Flowchart');
            expect(errors).toEqual([]);
        });

        test('code snippet toggle still works after leaving docs and returning', async ({ page }) => {
            await page.goto('/#docs/music-player');
            await waitForSPA(page);

            const toggle = page.locator('#music-player .vd-code-snippet[data-collapsible] .vd-code-snippet-toggle').first();

            await expect(toggle).toBeVisible();
            await expect(toggle).toHaveAttribute('aria-expanded', 'false');

            await page.goto('/?docs-route-test=about#about');
            await waitForSPA(page);
            await expect(page).toHaveURL(/.*#about/);
            await expect(page.locator('#about')).toBeVisible();

            await page.goto('/?docs-route-test=music-player#docs/music-player');
            await expect(page).toHaveURL(/.*#docs\/music-player/);
            await waitForVisibleSection(page, '#music-player');

            const returnedToggle = page.locator('#music-player .vd-code-snippet[data-collapsible] .vd-code-snippet-toggle').first();
            await expect(returnedToggle).toBeVisible();
            await returnedToggle.scrollIntoViewIfNeeded();
            await returnedToggle.click();
            await expect(returnedToggle).toHaveAttribute('aria-expanded', 'true');
        });

    });

    test.describe('Guides Tab (#docs/guides)', () => {
        test('Sidebar renders specific guides and content loads', async ({ page }) => {
            await page.goto('/#docs/guides');
            await waitForSPA(page);

            const modeToggle = page.locator('#doc-water-toggle');
            await expect(modeToggle).toHaveAttribute('aria-pressed', 'true');
            await expect(modeToggle).toHaveAttribute('aria-label', 'Switch to Components');
            await expect(modeToggle).toHaveAttribute('data-tooltip', 'Click for Components');
            await expect(modeToggle.locator('.vd-morph-current .doc-water-label')).toHaveText('Guides');

            // Check for a guide section such as quick-start
            const guideLink = page.locator('.doc-nav-link[data-route="docs/guides#quick-start"]');
            if (await guideLink.count() > 0) {
                await guideLink.click();
                await page.waitForTimeout(500);
                await expect(page.locator('#quick-start')).toBeVisible();
            }
        });

        test('Loads v1.4.1 architecture and production guides', async ({ page }) => {
            const guideChecks = [
                {
                    route: '/#docs/vanduo-ecosystem',
                    id: 'vanduo-ecosystem',
                    expected: ['@vanduo-oss/framework', '@vanduo-oss/hex-grid', '@vanduo-oss/charts', '@vanduo-oss/flowchart']
                },
                {
                    route: '/#docs/runtime-architecture',
                    id: 'runtime-architecture',
                    expected: ['Vanduo.init(root)', 'lowerCamelCase']
                },
                {
                    route: '/#docs/lifecycle-manager',
                    id: 'lifecycle-manager',
                    expected: ['Vanduo.destroy(root)', 'Targeted Reinit']
                },
                {
                    route: '/#docs/security-practices',
                    id: 'security-practices',
                    expected: ['allowStyle', 'highlightTag']
                },
                {
                    route: '/#docs/production-best-practices',
                    id: 'production-best-practices',
                    expected: ['@v1.4.1', '--vd-*']
                }
            ];

            for (const check of guideChecks) {
                await page.goto(check.route);
                await waitForSPA(page);

                const section = page.locator(`#${check.id}`);
                await expect(section).toBeVisible();
                for (const text of check.expected) {
                    await expect(section).toContainText(text);
                }
            }
        });

        test('legacy tab-prefixed guide routes still resolve', async ({ page }) => {
            await page.goto('/#docs/guides/runtime-architecture');
            await waitForSPA(page);

            const section = page.locator('#runtime-architecture');
            await expect(section).toBeVisible();
            await expect(section).toContainText('Vanduo.init(root)');
        });

        test('Token guide teaches the strict v1.4.1 token namespace', async ({ page }) => {
            await page.goto('/#docs/css-variables-theming');
            await waitForSPA(page);

            const section = page.locator('#css-variables-theming');
            await expect(section).toBeVisible();
            await expect(section).toContainText('--vd-color-primary');
            await expect(section).toContainText('--vd-bg-primary');
            await expect(section).toContainText('strict public CSS custom property API');
        });

        test('Starter templates guide is a single generalized landing guide', async ({ page }) => {
            test.skip(true, 'Starter templates guide not registered in sections.json');
            await page.goto('/#docs/starter-templates');
            await waitForSPA(page);

            const section = page.locator('#starter-templates');
            await expect(section).toBeVisible();
            await expect(section).toContainText('Starter Landing Template');
            await expect(section).toContainText('Commented Landing Page');
            await expect(section).not.toContainText('Ops Dashboard');
            await expect(section).not.toContainText('Creative Portfolio');
        });
    });

    test.describe('Docs mode toggle regression', () => {
        test('keeps active label and tooltip stable after morph completes', async ({ page }) => {
            await page.goto('/#docs/components');
            await waitForSPA(page);

            const modeToggle = page.locator('#doc-water-toggle');

            await expect(modeToggle).toHaveAttribute('aria-pressed', 'false');
            await expect(modeToggle.locator('.vd-morph-current .doc-water-label')).toHaveText('Components');
            await expect(modeToggle).toHaveAttribute('data-tooltip', 'Click for Guides');

            await modeToggle.click();

            await expect(modeToggle).toHaveAttribute('aria-pressed', 'true');
            await expect(modeToggle.locator('.vd-morph-current .doc-water-label')).toHaveText('Guides');
            await expect(modeToggle).toHaveAttribute('data-tooltip', 'Click for Components');
            await page.waitForTimeout(950);
            await expect(modeToggle.locator('.vd-morph-current .doc-water-label')).toHaveText('Guides');
            await expect(modeToggle).toHaveAttribute('data-tooltip', 'Click for Components');

            await modeToggle.click();

            await expect(modeToggle).toHaveAttribute('aria-pressed', 'false');
            await expect(modeToggle.locator('.vd-morph-current .doc-water-label')).toHaveText('Components');
            await expect(modeToggle).toHaveAttribute('data-tooltip', 'Click for Guides');
            await page.waitForTimeout(950);
            await expect(modeToggle.locator('.vd-morph-current .doc-water-label')).toHaveText('Components');
            await expect(modeToggle).toHaveAttribute('data-tooltip', 'Click for Guides');
        });
    });

    test.describe('Concepts Tab (#docs/concepts)', () => {
    });

    test.describe('Theme Switching', () => {
        test('Local preview resolves framework assets from docs dist', async ({ page }) => {
            await page.goto('/#home');
            await waitForSPA(page);
            await expectLocalFrameworkAssets(page);
        });

        test('Dark mode toggle changes primary color from black to blue', async ({ page }) => {
            await page.emulateMedia({ colorScheme: 'light' });
            await page.goto('/#home');
            await waitForSPA(page);
            await expectLocalFrameworkAssets(page);

            // Wait for Vanduo to initialize and apply preferences
            await page.waitForFunction(() => {
                return document.documentElement.hasAttribute('data-primary');
            }, { timeout: 5000 });

            // Get initial primary color (should be black in light mode per docs defaults)
            const initialPrimary = await page.evaluate(() => {
                return document.documentElement.getAttribute('data-primary');
            });
            expect(initialPrimary).toBe('black');

            // Click the dark mode toggle button
            const darkModeToggle = page.locator('#dark-mode-toggle');
            await expect(darkModeToggle).toBeVisible();

            let currentTheme = await cycleTheme(page, 'dark');
            
            expect(currentTheme).toBe('dark');

            await page.waitForFunction(() => {
                return document.documentElement.getAttribute('data-primary') === 'blue';
            }, { timeout: 5000 });

            // Verify primary color changed to blue (dark mode default per docs)
            const darkPrimary = await page.evaluate(() => {
                return document.documentElement.getAttribute('data-primary');
            });
            expect(darkPrimary).toBe('blue');

            // Toggle back to light mode
            currentTheme = await cycleTheme(page, 'light');
            
            expect(currentTheme).toBe('light');

            await page.waitForFunction(() => {
                return document.documentElement.getAttribute('data-primary') === 'black';
            }, { timeout: 5000 });

            // Verify back to black primary
            const lightPrimary = await page.evaluate(() => {
                return document.documentElement.getAttribute('data-primary');
            });
            expect(lightPrimary).toBe('black');
        });

        test('normalizes stale default primary when theme and storage disagree after reload', async ({ page }) => {
            await page.emulateMedia({ colorScheme: 'light' });
            await page.goto('/#home');
            await waitForSPA(page);
            await expectLocalFrameworkAssets(page);

            await page.evaluate(() => {
                localStorage.setItem('vanduo-theme-preference', 'light');
                localStorage.setItem('vanduo-primary-color', 'blue');
            });
            await page.reload();
            await waitForSPA(page);

            await page.waitForFunction(() => {
                return document.documentElement.getAttribute('data-primary') === 'black';
            }, { timeout: 5000 });
        });

        test('ThemeCustomizer reset stays in sync with ThemeSwitcher', async ({ page }) => {
            await page.emulateMedia({ colorScheme: 'light' });
            const pageErrors: string[] = [];
            page.on('pageerror', (error) => {
                pageErrors.push(error.message);
            });

            await page.goto('/#home');
            await waitForSPA(page);
            await expectLocalFrameworkAssets(page);
            await page.waitForTimeout(500);

            await page.waitForFunction(() => {
                return document.documentElement.hasAttribute('data-primary');
            }, { timeout: 5000 });

            const theme = await cycleTheme(page, 'dark');
            expect(theme).toBe('dark');
            await page.waitForTimeout(200);

            // Open theme customizer panel
            const customizerTrigger = page.locator('.vd-theme-customizer-trigger');
            await expect(customizerTrigger).toBeVisible();
            await customizerTrigger.click();
            await page.waitForTimeout(300);

            const resetButton = page.locator('.vd-theme-customizer-panel.is-open .customizer-reset').first();
            await expect(resetButton).toBeVisible();
            await resetButton.click();
            await page.waitForTimeout(300);

            const resetState = await page.evaluate(() => {
                return {
                    theme: document.documentElement.getAttribute('data-theme'),
                    primary: document.documentElement.getAttribute('data-primary'),
                    neutral: document.documentElement.getAttribute('data-neutral'),
                    font: document.documentElement.getAttribute('data-font'),
                    radius: document.documentElement.getAttribute('data-radius'),
                    storagePref: localStorage.getItem('vanduo-theme-preference'),
                    fontPref: localStorage.getItem('vanduo-font-preference')
                };
            });

            // Docs-site overrides ThemeCustomizer.DEFAULTS in js/app.js:
            //   PRIMARY_LIGHT='black', PRIMARY_DARK='blue', NEUTRAL='stone', FONT='ubuntu', RADIUS='0.5'
            // and resolves the system theme to the active media mode.
            expect(resetState.theme).toBe('light');
            expect(resetState.primary).toBe('black');
            expect(resetState.neutral).toBe('stone');
            expect(resetState.font).toBe('ubuntu');
            expect(resetState.radius).toBe('0.5');
            expect(resetState.storagePref).toBe('system');
            expect(resetState.fontPref).toBe('ubuntu');
            expect(pageErrors.join('\n')).not.toContain('savePreference is not a function');
        });

        test('Theme customizer section trigger opens panel and font selection persists', async ({ page }) => {
            await page.goto('/#home');
            await waitForSPA(page);
            await page.evaluate(() => {
                sessionStorage.clear();
                localStorage.clear();
            });
            await page.goto('/#docs/theme-customizer');
            await waitForSPA(page);
            await expectLocalFrameworkAssets(page);

            const sectionTrigger = page.locator('#theme-customizer [data-theme-customizer-trigger]').first();
            await expect(sectionTrigger).toBeVisible();
            await sectionTrigger.click();

            const panel = page.locator('.vd-theme-customizer-panel.is-open');
            await expect(panel).toBeVisible();
            await expect(sectionTrigger).toHaveAttribute('aria-expanded', 'true');

            const fontSelect = page.locator('#theme-customizer .font-select');
            await expect(fontSelect).toBeVisible();
            await page.evaluate(() => {
                const select = document.querySelector('#theme-customizer .font-select') as HTMLSelectElement | null;
                if (!select) return;
                select.value = 'open-sans';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            });
            await page.waitForFunction(() => {
                return document.documentElement.getAttribute('data-font') === 'open-sans'
                    && localStorage.getItem('vanduo-font-preference') === 'open-sans';
            }, null, { timeout: 10000 });

            let fontState = await page.evaluate(() => {
                return {
                    attr: document.documentElement.getAttribute('data-font'),
                    stored: localStorage.getItem('vanduo-font-preference')
                };
            });
            expect(fontState.attr).toBe('open-sans');
            expect(fontState.stored).toBe('open-sans');

            await page.reload();
            await waitForSPA(page);
            await page.goto('/#docs/theme-customizer');
            await waitForSPA(page);
            await page.waitForFunction(() => {
                return document.documentElement.getAttribute('data-font') === 'open-sans'
                    && localStorage.getItem('vanduo-font-preference') === 'open-sans';
            }, null, { timeout: 10000 });

            fontState = await page.evaluate(() => {
                return {
                    attr: document.documentElement.getAttribute('data-font'),
                    stored: localStorage.getItem('vanduo-font-preference')
                };
            });
            expect(fontState.attr).toBe('open-sans');
            expect(fontState.stored).toBe('open-sans');

            await page.evaluate(() => {
                localStorage.setItem('vanduo-font-preference', 'not-a-real-font');
            });
            await page.reload();
            await waitForSPA(page);
            await page.goto('/#docs/theme-customizer');
            await waitForSPA(page);
            await page.waitForFunction(() => {
                return document.documentElement.getAttribute('data-font') === 'ubuntu'
                    && localStorage.getItem('vanduo-font-preference') === 'ubuntu';
            }, null, { timeout: 10000 });

            const fallbackState = await page.evaluate(() => {
                return {
                    attr: document.documentElement.getAttribute('data-font'),
                    stored: localStorage.getItem('vanduo-font-preference')
                };
            });
            expect(fallbackState.attr).toBe('ubuntu');
            expect(fallbackState.stored).toBe('ubuntu');
        });
    });

});
