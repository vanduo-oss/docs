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

            // Expand a snippet if it's collapsible
            const collapseToggle = page.locator('.vd-code-snippet[data-collapsible] .vd-code-snippet-toggle').first();
            await collapseToggle.click();
            await page.waitForTimeout(300);

            const snippet = page.locator('.vd-code-snippet').first();
            await expect(snippet).toBeVisible();

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

        test('Copy button works and updates text state', async ({ page }) => {
            // Create a mock clipboard securely via defineProperty
            await page.addInitScript(() => {
                let text = '';
                Object.defineProperty(navigator, 'clipboard', {
                    value: {
                        writeText: async (t: string) => { text = t; },
                        readText: async () => text
                    },
                    writable: true,
                    configurable: true
                });
            });

            await page.goto('/#docs/buttons');
            await waitForSPA(page);

            // Expand snippet before looking for copy button
            const toggleBtn = page.locator('.vd-code-snippet-toggle').first();
            if (await toggleBtn.isVisible()) {
                await toggleBtn.click();
                await page.waitForTimeout(300); // Wait for expansion
            }

            const copyBtn = page.locator('.vd-code-snippet-copy').first();
            await copyBtn.scrollIntoViewIfNeeded();

            await expect(copyBtn).not.toHaveClass(/is-copied/);

            // Note: testing actual clipboard APIs in Playwright requires special permissions.
            // Easiest is to test the visual state change.
            await copyBtn.click({ force: true });

            await expect(copyBtn).toHaveClass(/is-copied/);

            // Should revert back after a timeout (2000ms in code + some buffer)
            await page.waitForTimeout(2500);
            await expect(copyBtn).not.toHaveClass(/is-copied/);
        });
    });

    test.describe('Interactive Demos', () => {
        test('Toast demo triggers component', async ({ page }) => {
            await page.goto('/#docs/toast');
            await waitForSPA(page);

            // Click a Toast demo button
            const toastBtn = page.getByRole('button', { name: 'Show Default Toast' }).first();
            if (await toastBtn.isVisible()) {
                await toastBtn.click();

                // Assert Toast component appears in DOM
                const toast = page.locator('.vd-toast').first();
                await expect(toast).toBeVisible();
            }
        });

        test('Modal demo opens modal', async ({ page }) => {
            await page.goto('/#docs/modals');
            await waitForSPA(page);

            // Click a Modal demo button
            const modalBtn = page.getByRole('button', { name: 'Open Default Modal' }).first();
            if (await modalBtn.isVisible()) {
                await modalBtn.click();

                const modal = page.locator('#demo-modal-first');
                await expect(modal).toBeVisible();
                await expect(modal).toHaveClass(/is-active/);

                // Close it
                await page.keyboard.press('Escape');
                await page.waitForTimeout(300);
                await expect(modal).not.toHaveClass(/is-active/);
            }
        });
    });
});
