import { test, expect } from '@playwright/test';

async function waitForSPA(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => {
        return document.querySelector('#page-view.is-active') !== null && document.querySelector('#page-view .vd-dynamic-loader') === null
            || document.querySelector('#docs-view.is-active') !== null;
    }, { timeout: 10000 });
}

test.describe('3. Page Views', () => {

    test.describe('Home View (#home)', () => {
        test('Hero section displays correctly', async ({ page }) => {
            await page.goto('/');
            await waitForSPA(page);

            const hero = page.locator('#hero');
            await expect(hero).toBeVisible();

            const title = hero.locator('h1');
            // The SVG icon inside the H1 makes exact text matching tricky, check textContent directly
            const textContent = await title.textContent();
            expect(textContent).toMatch(/Vanduo\s*Framework/);

            const getStartedBtn = hero.locator('a[data-route="docs/getting-started"]');
            await expect(getStartedBtn).toBeVisible();
        });

        test('Hero search works', async ({ page, isMobile }) => {
            // Hero search is usually hidden or overlayed on mobile
            test.skip(!!isMobile, 'Hero search tested mainly on desktop');

            await page.goto('/');
            await waitForSPA(page);

            const heroSearchInput = page.locator('#hero-search-input');
            await expect(heroSearchInput).toBeVisible();

            await heroSearchInput.fill('card');
            await page.waitForTimeout(300);

            const dropdown = page.locator('#hero-search-dropdown');
            await expect(dropdown).toBeVisible();

            const results = dropdown.locator('.global-search-result');
            await expect(results).not.toHaveCount(0);

            // Click first result
            await results.first().click();
            await page.waitForTimeout(500);

            await expect(page).toHaveURL(/.*#docs\//);
        });

        test('Links to Docs and GitHub work', async ({ page }) => {
            await page.goto('/');
            await waitForSPA(page);

            const getStartedBtn = page.locator('#hero a[data-route="docs/getting-started"]');
            await expect(getStartedBtn).toBeVisible();
            await getStartedBtn.click();

            await waitForSPA(page);

            await expect(page).toHaveURL(/.*#docs\/getting-started/);
            // Verify docs view is loaded instead of sidebar
            await expect(page.locator('#docs-view')).toBeAttached();

            // Go back to test GitHub link
            await page.goBack();
            await waitForSPA(page);

            const githubBtn = page.locator('#hero a[href*="github.com"]');
            const [newPage] = await Promise.all([
                page.waitForEvent('popup'),
                githubBtn.click()
            ]);
            await expect(newPage).toHaveURL(/.*github\.com/);
        });
    });

    test.describe('About View (#about)', () => {
        test('Loads correctly and displays content', async ({ page }) => {
            await page.goto('/#about');
            await waitForSPA(page);

            const aboutSection = page.locator('#about');
            await expect(aboutSection).toBeVisible();

            const title = aboutSection.locator('h1');
            await expect(title).toContainText('About');
        });

        test('Founder\'s image box opens properly', async ({ page }) => {
            await page.goto('/#about');
            await waitForSPA(page);

            const imageTrigger = page.locator('.founders-image-wrap img[data-image-box]');
            await imageTrigger.scrollIntoViewIfNeeded();
            await expect(imageTrigger).toBeVisible();

            await imageTrigger.click();
            await page.waitForTimeout(500);

            const imageBox = page.locator('.vd-image-box-backdrop.is-visible');
            await expect(imageBox).toBeVisible();

            const caption = imageBox.locator('.vd-image-box-caption');
            await expect(caption).toHaveText(/Vanduo Foundation/);

            // Close it
            const closeBtn = imageBox.locator('.vd-image-box-close');
            await closeBtn.click();
            await page.waitForTimeout(500);

            await expect(imageBox).not.toBeVisible();
        });
    });

    test.describe('Changelog View (#changelog)', () => {
        test('Loads correctly and displays release notes', async ({ page }) => {
            await page.goto('/#changelog');
            await waitForSPA(page);

            const changelogSection = page.locator('#changelog');
            await expect(changelogSection).toBeVisible();

            const title = changelogSection.locator('h1');
            await expect(title).toContainText('Changelog');

            // Verify at least one release note is present, or the API limit fallback alert
            // Verify at least one version card is present
            const releases = changelogSection.locator('.version-card');
            await expect(releases.first()).toBeVisible({ timeout: 10000 });
        });
    });

});
