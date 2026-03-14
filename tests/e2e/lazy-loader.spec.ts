import path from 'node:path';
import { test, expect } from '@playwright/test';

const lazyLoaderScriptPath = path.resolve(__dirname, '../../js/lazy-loader.js');

test.describe('Lazy Loader Component', () => {

    test('Unit Test - Component isolation via page.evaluate', async ({ page }) => {
        // Load a blank page and inject our module
        await page.goto('about:blank');
        await page.addScriptTag({ path: lazyLoaderScriptPath });

        // Wait for VanduoLazyLoader to be available
        await page.waitForFunction(() => typeof window.VanduoLazyLoader !== 'undefined', { timeout: 10000 });

        const callbackFired = await page.evaluate(async () => {
            return new Promise((resolve) => {
                const content = document.createElement('div');
                content.style.height = '3000px';
                document.body.appendChild(content);

                const loader = new window.VanduoLazyLoader({
                    container: document.body,
                    onLoadNext: () => {
                        loader.disconnect();
                        content.remove();
                        resolve(true);
                    },
                    rootMargin: '100px', // Smaller margin for easier trigger
                    sentinelId: 'test-sentinel'
                });

                loader.init();

                // Scroll the window to intersect the sentinel
                setTimeout(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                }, 100);
            });
        });

        expect(callbackFired).toBe(true);
    });

    test('Integration Test - Infinite scroll loads next section', async ({ page }) => {
        await page.goto('/#docs/components');

        // Wait for page to finish loading initial SPA content
        await page.waitForFunction(() => {
            return document.querySelector('#docs-view.is-active') !== null
                && document.querySelectorAll('section[id]').length > 0;
        }, { timeout: 10000 });

        // Ensure the sentinel exists
        const sentinel = page.locator('#infinite-scroll-sentinel');
        await expect(sentinel).toBeAttached();

        // Track how many sections are initially loaded
        const initialSectionsCount = await page.locator('#dynamic-content > section').count();

        // Scroll to the sentinel to trigger loadNextSection
        await sentinel.scrollIntoViewIfNeeded();

        // Wait until new section is loaded (either placeholders appear or section count increases)
        await page.waitForFunction((prevCount) => {
            const currentSections = document.querySelectorAll('#dynamic-content > section').length;
            const hasPlaceholders = document.querySelectorAll('#dynamic-content > div[id^="dynamic-placeholder-"]').length > 0;
            return currentSections > prevCount || hasPlaceholders;
        }, initialSectionsCount, { timeout: 10000 });

        // Eventually, the number of loaded sections should increase
        await page.waitForFunction((prevCount) => {
            return document.querySelectorAll('#dynamic-content > section').length > prevCount;
        }, initialSectionsCount, { timeout: 10000 });

        const newSectionsCount = await page.locator('#dynamic-content > section').count();
        expect(newSectionsCount).toBeGreaterThan(initialSectionsCount);
    });

});
