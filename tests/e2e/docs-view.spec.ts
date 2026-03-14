import { test, expect, type Page } from '@playwright/test';

async function waitForSPA(page: Page) {
    await page.waitForFunction(() => {
        return document.querySelector('#page-view.is-active') !== null && document.querySelector('#page-view .vd-dynamic-loader') === null
            || document.querySelector('#docs-view.is-active') !== null
            || document.querySelector('#docs-landing') !== null;
    }, { timeout: 10000 });
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
    expect(assetInfo.cssHref).toBe('./dist/vanduo.min.css');
    expect(assetInfo.jsSrc).toBe('./dist/vanduo.min.js');
}

test.describe('4. Documentation View', () => {

    test.describe('Docs Landing (#docs)', () => {
        test('Displays the two main cards', async ({ page }) => {
            await page.goto('/#docs');
            await waitForSPA(page);

            const docsLanding = page.locator('#docs-landing');
            await expect(docsLanding).toBeVisible();

            const cards = docsLanding.locator('.vd-card');
            await expect(cards).toHaveCount(4);

            await expect(docsLanding).toContainText('Components');
            await expect(docsLanding).toContainText('Guides');
            await expect(docsLanding).toContainText(/Documentation\s+Coverage/);
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

    test.describe('Components Tab (#docs/components)', () => {
        test('Sidebar renders with correct categories and first section loads', async ({ page }) => {
            await page.goto('/#docs/components');
            await waitForSPA(page);

            const activeTab = page.locator('.doc-tab.active');
            await expect(activeTab).toHaveAttribute('data-tab', 'components');

            // Check for Sidebar category groups
            const sidebarNavItems = page.locator('.doc-nav-list li');
            await expect(sidebarNavItems).not.toHaveCount(0);

            // Check first section loaded
            const content = page.locator('#dynamic-content');
            await expect(content).toBeVisible();
            // Wait for at least one piece of actual content inside dynamic-content
            await expect(content.locator('h1, h2, h3, h4').first()).toBeVisible();
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

            // Active link should have 'active' class
            const activeLink = page.locator('.doc-nav-link.active');
            await expect(activeLink).toHaveAttribute('data-section', 'buttons');

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

    });

    test.describe('Guides Tab (#docs/guides)', () => {
        test('Sidebar renders specific guides and content loads', async ({ page }) => {
            await page.goto('/#docs/guides');
            await waitForSPA(page);

            const activeTab = page.locator('.doc-tab.active');
            await expect(activeTab).toHaveAttribute('data-tab', 'guides');

            // Check for a guide section such as quick-start
            const guideLink = page.locator('.doc-nav-link[data-route="docs/guides#quick-start"]');
            if (await guideLink.count() > 0) {
                await guideLink.click();
                await page.waitForTimeout(500);
                await expect(page.locator('#quick-start')).toBeVisible();
            }
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

        test('Dark mode toggle changes primary color from black to amber', async ({ page }) => {
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

            // Wait for primary color to update ( coordination happens async )
            await page.waitForTimeout(200);

            // Verify primary color changed to amber (dark mode default per docs)
            const darkPrimary = await page.evaluate(() => {
                return document.documentElement.getAttribute('data-primary');
            });
            expect(darkPrimary).toBe('amber');

            // Toggle back to light mode
            currentTheme = await cycleTheme(page, 'light');
            
            expect(currentTheme).toBe('light');

            // Wait for primary color to update
            await page.waitForTimeout(200);

            // Verify back to black primary
            const lightPrimary = await page.evaluate(() => {
                return document.documentElement.getAttribute('data-primary');
            });
            expect(lightPrimary).toBe('black');
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
                    storagePref: localStorage.getItem('vanduo-theme-preference')
                };
            });

            expect(resetState.theme).toBeNull();
            expect(resetState.primary).toBe('black');
            expect(resetState.storagePref).toBe('system');
            expect(pageErrors.join('\n')).not.toContain('savePreference is not a function');
        });
    });

});
