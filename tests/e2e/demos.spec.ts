import { test, expect } from '@playwright/test';

async function waitForSPA(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => {
        return document.querySelector('#page-view.is-active') !== null && document.querySelector('#page-view .vd-dynamic-loader') === null
            || document.querySelector('#docs-view.is-active') !== null
            || document.querySelector('#docs-landing') !== null;
    }, { timeout: 10000 });
}

test.describe('5. Interactive Demos & Code Snippets', () => {

    test.describe('Code Snippets', () => {
        test('Tabs (HTML, CSS, JS) switch correctly', async ({ page }) => {
            // Find a page with a code snippet
            await page.goto('/#docs/buttons');
            await waitForSPA(page);

            const snippet = page.locator('.vd-code-snippet').filter({
                has: page.locator('.vd-code-snippet-tab[data-lang="css"]')
            }).first();
            await expect(snippet).toBeVisible();

            // Expand a snippet if it's collapsible
            const collapseToggle = snippet.locator('.vd-code-snippet-toggle').first();
            await collapseToggle.click();
            await page.waitForTimeout(300);

            // Check default active tab
            const htmlTab = snippet.locator('.vd-code-snippet-tab[data-lang="html"]');
            const cssTab = snippet.locator('.vd-code-snippet-tab[data-lang="css"]');
            const jsTab = snippet.locator('.vd-code-snippet-tab[data-lang="js"]');

            const htmlPane = snippet.locator('.vd-code-snippet-pane[data-lang="html"]');
            const cssPane = snippet.locator('.vd-code-snippet-pane[data-lang="css"]');

            // Click CSS tab
            if (await cssTab.isVisible() && !await cssTab.isDisabled()) {
                await cssTab.click();
                await expect(cssTab).toHaveClass(/is-active/);
                await expect(cssPane).toHaveClass(/is-active/);
                await expect(htmlPane).not.toHaveClass(/is-active/);
            }
        });

    });

    test.describe('Interactive Demos', () => {
        test('Toast demo triggers component', async ({ page }) => {
            await page.goto('/#docs/toast');
            await waitForSPA(page);

            // Click a Toast demo button (v1.3.7 layout uses 'Success Toast')
            const toastBtn = page.getByRole('button', { name: 'Success Toast' }).first();
            if (await toastBtn.isVisible()) {
                await toastBtn.click();

                // Assert Toast component appears in DOM
                const toast = page.locator('.vd-toast').first();
                await expect(toast).toBeVisible();
            }
        });

        test('Offcanvas demo opens the bottom panel as a viewport overlay', async ({ page }) => {
            await page.goto('/#docs/offcanvas');
            await waitForSPA(page);

            const trigger = page.locator('[data-sidenav-toggle="#offcanvas-bottom-demo"]').first();
            const panel = page.locator('#offcanvas-bottom-demo');

            await trigger.click();
            await expect(panel).toHaveClass(/is-open/);
            await expect.poll(() => panel.evaluate((node) => node.parentElement === document.body)).toBe(true);

            const metrics = await panel.evaluate((node) => {
                const rect = node.getBoundingClientRect();
                return { bottom: rect.bottom, viewportHeight: window.innerHeight };
            });

            expect(Math.abs(metrics.bottom - metrics.viewportHeight)).toBeLessThanOrEqual(2);
        });

        test('Modal demo opens above its backdrop', async ({ page }) => {
            await page.goto('/#docs/modals');
            await waitForSPA(page);

            const modalBtn = page.locator('[data-modal="#demo-modal-default"]').first();
            const modal = page.locator('#demo-modal-default');

            await page.waitForFunction(() => {
                const trigger = document.querySelector('[data-modal="#demo-modal-default"]');
                return trigger?.dataset.modalTriggerInitialized === 'true';
            });

            await modalBtn.click();
            await expect(modal).toHaveClass(/is-open/);
            await expect.poll(() => modal.evaluate((node) => node.parentElement === document.body)).toBe(true);

            const layerInfo = await page.evaluate(() => {
                const modalEl = document.querySelector('#demo-modal-default');
                const backdropEl = document.querySelector('.vd-modal-backdrop.is-visible');
                return {
                    modalZ: modalEl ? Number(window.getComputedStyle(modalEl).zIndex) : 0,
                    backdropZ: backdropEl ? Number(window.getComputedStyle(backdropEl).zIndex) : 0
                };
            });

            expect(layerInfo.modalZ).toBeGreaterThan(layerInfo.backdropZ);

            await page.keyboard.press('Escape');
            await expect(modal).not.toHaveClass(/is-open/);
        });

        test('Modal size demo preserves distinct desktop width tiers', async ({ page }) => {
            const viewport = page.viewportSize();
            test.skip(!viewport || viewport.width < 992, 'Desktop-only modal width expectation.');

            await page.goto('/#docs/modals');
            await waitForSPA(page);

            await page.waitForFunction(() => {
                const trigger = document.querySelector('[data-modal="#demo-modal-default"]');
                return trigger?.dataset.modalTriggerInitialized === 'true';
            });

            const measureDialogWidth = async (triggerSelector: string, modalSelector: string) => {
                await page.locator(triggerSelector).first().click();
                await expect(page.locator(modalSelector)).toHaveClass(/is-open/);

                const width = await page.locator(`${modalSelector} .vd-modal-dialog`).evaluate((node) => {
                    return Math.round(node.getBoundingClientRect().width);
                });

                await page.keyboard.press('Escape');
                await expect(page.locator(modalSelector)).not.toHaveClass(/is-open/);

                return width;
            };

            const smallWidth = await measureDialogWidth('[data-modal="#demo-modal-sm"]', '#demo-modal-sm');
            const defaultWidth = await measureDialogWidth('[data-modal="#demo-modal-default"]', '#demo-modal-default');
            const largeWidth = await measureDialogWidth('[data-modal="#demo-modal-lg"]', '#demo-modal-lg');
            const extraLargeWidth = await measureDialogWidth('[data-modal="#demo-modal-xl"]', '#demo-modal-xl');

            expect(smallWidth).toBeLessThan(defaultWidth);
            expect(defaultWidth).toBeLessThan(largeWidth);
            expect(largeWidth).toBeLessThan(extraLargeWidth);

            expect(defaultWidth - smallWidth).toBeGreaterThanOrEqual(120);
            expect(largeWidth - defaultWidth).toBeGreaterThanOrEqual(180);
            expect(extraLargeWidth - largeWidth).toBeGreaterThanOrEqual(300);
        });

        test('Sidenav demo opens as a real left-edge overlay', async ({ page }) => {
            await page.goto('/#docs/sidenav');
            await waitForSPA(page);

            const trigger = page.locator('[data-sidenav-toggle="#demo-sidenav-inline"]').first();
            const sidenav = page.locator('#demo-sidenav-inline');

            await trigger.click();
            await expect(sidenav).toHaveClass(/is-open/);
            await expect.poll(() => sidenav.evaluate((node) => node.parentElement === document.body)).toBe(true);

            const left = await sidenav.evaluate((node) => node.getBoundingClientRect().left);
            expect(Math.abs(left)).toBeLessThanOrEqual(1);
        });

        test('Dropdown demo leaves the code toggle unobscured', async ({ page }) => {
            await page.goto('/#docs/dropdown');
            await waitForSPA(page);

            const toggle = page.locator('#demo-dropdown-basic [data-vd-dropdown-toggle]').first();
            const menu = page.locator('#demo-dropdown-basic .vd-dropdown-menu').first();
            const snippetToggle = page.locator('#demo-dropdown-basic + .vd-code-snippet .vd-code-snippet-toggle').first();

            await toggle.click();
            await expect(menu).toHaveClass(/is-open/);

            const bounds = await Promise.all([
                menu.evaluate((node) => {
                    const rect = node.getBoundingClientRect();
                    return { bottom: rect.bottom };
                }),
                snippetToggle.evaluate((node) => {
                    const rect = node.getBoundingClientRect();
                    return { top: rect.top };
                })
            ]);

            expect(bounds[0].bottom).toBeLessThanOrEqual(bounds[1].top);
        });

        test('Stepper demo previous and next controls change the active step', async ({ page }) => {
            await page.goto('/#docs/stepper');
            await waitForSPA(page);
            await page.waitForSelector('#stepper-h-demo', { state: 'attached', timeout: 25000 });

            const stepper = page.locator('#stepper-h-demo');
            const activeLabel = stepper.locator('.vd-stepper-item.is-active .vd-stepper-label');

            await expect(activeLabel).toContainText('Preferences');

            await page.locator('[data-stepper-demo-control="next"][data-stepper-target="#stepper-h-demo"]').click();
            await expect(activeLabel).toContainText('Confirmation');

            await page.locator('[data-stepper-demo-control="prev"][data-stepper-target="#stepper-h-demo"]').click();
            await expect(activeLabel).toContainText('Preferences');
        });

        test('Spotlight demo starts without missing-handler errors', async ({ page }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));

            await page.goto('/#docs/spotlight');
            await waitForSPA(page);

            const spotlightBtn = page.getByRole('button', { name: 'Start Tour' }).first();
            await spotlightBtn.click();

            await expect(page.locator('.vd-spotlight-overlay')).toBeVisible();
            await expect(page.locator('.vd-spotlight-tooltip')).toBeVisible();
            expect(errors.join('\n')).not.toContain('startDemoTour is not defined');
        });
    });
});
