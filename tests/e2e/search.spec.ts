import { test, expect } from '@playwright/test';

async function waitForSPA(page: import('@playwright/test').Page) {
    await page.waitForFunction(() => {
        return document.querySelector('#page-view.is-active') !== null && document.querySelector('#page-view .vd-dynamic-loader') === null
            || document.querySelector('#docs-view.is-active') !== null;
    }, { timeout: 10000 });
}

test.describe('2. Search Functionality', () => {

    test('Cmd+K opens global search modal from docs and home', async ({ page }) => {
        await page.goto('/#about');
        await waitForSPA(page);

        // Press Cmd+K (or Ctrl+K on Windows/Linux)
        const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
        await page.keyboard.press(`${modifier}+k`);
        await page.waitForTimeout(300);

        const modal = page.locator('#global-search-modal');
        // It should open on non-home pages
        await expect(modal).toHaveClass(/is-open/);

        // Close the modal
        await page.keyboard.press('Escape');
        await expect(modal).not.toHaveClass(/is-open/);

        // Now go to home page
        await page.goto('/#home');
        await waitForSPA(page);

        await page.keyboard.press(`${modifier}+k`);
        await page.waitForTimeout(300);
        await expect(modal).toHaveClass(/is-open/);
        const globalSearchInput = page.locator('#global-search-input');
        await expect(globalSearchInput).toBeFocused();
    });

    test('Search input accurately filters across multiple sections', async ({ page }) => {
        await page.goto('/#about');
        await waitForSPA(page);

        // Open global search modal by clicking the icon in navbar
        await page.locator('#global-search-trigger').click();

        const searchInput = page.locator('#global-search-input');
        await searchInput.fill('button');
        await page.waitForTimeout(300); // debounce wait

        const searchResults = page.locator('#global-search-results .global-search-result');
        // Ensure we have at least one result containing "button"
        await expect(searchResults).not.toHaveCount(0);
        const firstResultText = await searchResults.first().textContent();
        expect(firstResultText?.toLowerCase()).toContain('button');
    });

    test('Search keyboard navigation (Up/Down/Enter) works correctly', async ({ page }) => {
        await page.goto('/#about');
        await waitForSPA(page);

        await page.locator('#global-search-trigger').click();

        const searchInput = page.locator('#global-search-input');
        await searchInput.fill('button');
        await page.waitForTimeout(300);

        const modal = page.locator('#global-search-modal');

        // Press down arrow
        await searchInput.press('ArrowDown');
        let activeResult = modal.locator('.global-search-result.is-active');
        await expect(activeResult).toBeVisible();
        await expect(activeResult).toHaveAttribute('data-index', '0');

        // Press down again
        await searchInput.press('ArrowDown');
        if (await page.locator('.global-search-result').count() > 1) {
            await expect(activeResult).toHaveAttribute('data-index', '1');
        }

        // Press up arrow
        await searchInput.press('ArrowUp');
        await expect(activeResult).toHaveAttribute('data-index', '0');

        // Press Enter to navigate
        await searchInput.press('Enter');
        await page.waitForTimeout(500); // Wait for navigation and modal close

        // Modal should close
        await expect(modal).not.toHaveClass(/is-open/);

        // URL should change
        await expect(page).toHaveURL(/.*#docs\//);
    });

    test('Clicking a search result navigates to the specific section and closes modal', async ({ page }) => {
        await page.goto('/#about');
        await waitForSPA(page);

        await page.locator('#global-search-trigger').click();

        const searchInput = page.locator('#global-search-input');
        await searchInput.fill('button');
        await page.waitForTimeout(300);

        const searchResults = page.locator('#global-search-results .global-search-result');
        await searchResults.first().click({ force: true });

        // Wait for route change
        await page.waitForTimeout(500);

        const modal = page.locator('#global-search-modal');
        await expect(modal).not.toHaveClass(/is-open/);

        // We should be on a docs section (e.g. #docs/forms)
        await expect(page).toHaveURL(/.*#docs\//);
    });

    test('No results state displays correctly', async ({ page }) => {
        await page.goto('/#about');
        await waitForSPA(page);

        await page.locator('#global-search-trigger').click();

        const searchInput = page.locator('#global-search-input');
        await searchInput.fill('xyznonexistentsearchtermxyz');
        await page.waitForTimeout(300);

        const noResults = page.locator('.global-search-empty');
        await expect(noResults).toBeVisible();
        await expect(noResults).toHaveText(/No results found/);
    });

});
