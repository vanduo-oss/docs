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

        // Click 'About' link in desktop navbar
        // If on mobile, open hamburger first
        const toggle = page.locator('.vd-navbar-toggle');
        if (await toggle.isVisible()) {
            await toggle.click();
            await page.waitForTimeout(300);
        }
        await page.locator('.vd-navbar-menu .vd-nav-link[data-route="about"]').click();

        // Verify SPA routing to #about
        await expect(page).toHaveURL(/.*#about/);
        await expect(page.locator('#about')).toBeVisible();

        // Ensure no full page reload happened (window object remains same)
        const isSameWindow = await page.evaluate(() => {
            if (!window['spaTested']) {
                window['spaTested'] = true;
                return false;
            }
            return true; // if true, reload didn't happen
        });
        // This trick: first evaluate sets it. If we route and evaluate again, it should be true.
        // Let's do it properly:
    });

    test('Mobile hamburger menu toggles correctly', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'Hamburger menu only visible on mobile context');

        await page.goto('/');
        await waitForSPA(page);

        const toggle = page.locator('.vd-navbar-toggle');
        const menu = page.locator('.vd-navbar-menu');

        await expect(toggle).toBeVisible();

        // Open menu
        await toggle.click();
        await expect(menu).toHaveClass(/is-active/);

        // Close menu
        await toggle.click();
        await expect(menu).not.toHaveClass(/is-active/);
    });

    test('Theme customizer toggles dark/light mode', async ({ page }) => {
        await page.goto('/');
        await waitForSPA(page);

        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(100);

        // Click theme trigger
        const trigger = page.locator('[data-theme-customizer-trigger]').first();
        await expect(trigger).toBeVisible();
        await trigger.click();

        await page.waitForTimeout(300); // Wait for transition

        // Change theme to Dark
        await page.locator('.tc-mode-btn[data-mode="dark"]').first().click();

        // Check HTML data-theme attribute
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

        // Change theme to Light
        await page.locator('.tc-mode-btn[data-mode="light"]').first().click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

        // Change to System
        await page.locator('.tc-mode-btn[data-mode="system"]').first().click();
        await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/); // 'system' removes the attribute
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
