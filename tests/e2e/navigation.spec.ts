import { test, expect } from '@playwright/test';

async function waitForSPA(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => {
        return document.querySelector('#page-view.is-active') !== null && document.querySelector('#page-view .vd-dynamic-loader') === null
            || document.querySelector('#docs-view.is-active') !== null
            || document.querySelector('#docs-landing') !== null;
    }, { timeout: 10000 });
}

test.describe('1. Global Navigation & Layout', () => {

    test('Navbar links navigate without full reload', async ({ page }) => {
        await page.goto('/');
        await waitForSPA(page);

        // Initial state
        await expect(page.locator('#home')).toBeVisible();

        // Click 'Docs' link in the primary navbar menu.
        // About/Changelog live in the footer only now, so the navbar menu
        // exposes Home / Docs / Labs.
        const toggle = page.locator('.vd-navbar-toggle');
        if (await toggle.isVisible()) {
            await toggle.click();
            await page.waitForTimeout(300);
        }
        await page.locator('.vd-navbar-menu .vd-nav-link[data-route="docs"]').click();

        // Verify SPA routing to #docs
        await expect(page).toHaveURL(/.*#docs/);
        await expect(page.locator('#docs-landing')).toBeVisible();
    });



    test('Footer links route properly and open external links in new tabs', async ({ page }) => {
        await page.goto('/');
        await waitForSPA(page);

        // Route link test (Changelog)
        await page.locator('.vd-footer-links a[data-route="changelog"]').first().click();
        await expect(page).toHaveURL(/.*#changelog/);
        await expect(page.locator('#changelog')).toBeVisible();

        // External link test (GitHub)
        const githubLink = page.locator('.vd-footer-links a[href*="github.com"]').first();
        const [newPage] = await Promise.all([
            page.waitForEvent('popup'),
            githubLink.click()
        ]);
        await expect(newPage).toHaveURL(/.*github\.com/);
    });

    test('Back/Forward browser history works seamlessly', async ({ page }) => {
        await page.goto('/');
        await waitForSPA(page);

        // Go to About
        await page.goto('/#about');
        await expect(page.locator('#about')).toBeVisible();

        // Go to Docs
        await page.goto('/#docs');
        await expect(page.locator('#docs-landing')).toBeVisible();

        // Use browser Back
        await page.goBack();
        await expect(page).toHaveURL(/.*#about/);
        await expect(page.locator('#about')).toBeVisible();

        // Use browser Forward
        await page.goForward();
        await expect(page).toHaveURL(/.*#docs/);
        await expect(page.locator('#docs-landing')).toBeVisible();
    });
});
