import { test, expect, type Page } from '@playwright/test';

async function waitForSPA(page: Page) {
    await page.waitForFunction(() => {
        return document.querySelector('#page-view.is-active') !== null && document.querySelector('#page-view .vd-dynamic-loader') === null
            || document.querySelector('#docs-view.is-active') !== null
            || document.querySelector('#docs-landing') !== null;
    }, { timeout: 10000 });
}

async function waitForMorphSection(page: Page) {
    await page.goto('/#docs/morph');
    await waitForSPA(page);
    await page.waitForSelector('#morph', { state: 'attached', timeout: 25000 });
    await page.waitForTimeout(500);
}

test.describe('Water Morph – Docs Section', () => {
    test.slow();

    test.beforeEach(async ({ page }) => {
        await waitForMorphSection(page);
    });

    test('section loads and heading is visible', async ({ page }) => {
        const heading = page.locator('#morph .demo-title');
        await expect(heading).toBeVisible();
        await expect(heading).toContainText('Water Morph');
    });

    test('Mode Toggle demo – click morphs content', async ({ page }) => {
        const btn = page.locator('#demo-morph-toggle-btn');
        await expect(btn).toBeVisible();
        await expect(btn.locator('.vd-morph-current')).toContainText('Light Mode');

        await btn.click();

        await expect(btn.locator('.vd-morph-current')).toContainText('Dark Mode', { timeout: 8000 });
    });

    test('Theme card demo – click swaps content', async ({ page }) => {
        const card = page.locator('#demo-morph-theme-card');
        await expect(card).toBeVisible();
        await expect(card.locator('.vd-morph-current')).toContainText('Light Theme');

        await card.click();

        await expect(card.locator('.vd-morph-current')).toContainText('Dark Theme', { timeout: 8000 });
    });

    test('Status badge demo – click cycles to next status', async ({ page }) => {
        const badge = page.locator('#demo-morph-badge-btn');
        await expect(badge).toBeVisible();
        await expect(badge.locator('.vd-morph-current')).toContainText('Online');

        await badge.click();

        await expect(badge.locator('.vd-morph-current')).toContainText('Away', { timeout: 8000 });
        await expect(badge).toHaveClass(/morph-badge-away/);
    });

    test('Priority badge demo – click cycles', async ({ page }) => {
        const badge = page.locator('#demo-morph-badge-priority');
        await expect(badge).toBeVisible();
        await expect(badge.locator('.vd-morph-current')).toContainText('Low');

        await badge.click();

        await expect(badge.locator('.vd-morph-current')).toContainText('Medium', { timeout: 8000 });
        await expect(badge).toHaveClass(/morph-badge-priority-medium/);
    });

    test('Caption reveal demo – click reveals expanded text', async ({ page }) => {
        const card = page.locator('#demo-morph-caption-card');
        await expect(card).toBeVisible();
        await expect(card.locator('.vd-morph-current')).toContainText('Click to reveal');

        await card.click();

        await expect(card.locator('.vd-morph-current')).toContainText('Golden light spills', { timeout: 8000 });
    });

    test('keyboard accessibility – Enter triggers morph', async ({ page }) => {
        const btn = page.locator('#demo-morph-toggle-btn');
        await btn.focus();
        await page.keyboard.press('Enter');

        await expect(btn.locator('.vd-morph-current')).toContainText('Dark Mode', { timeout: 8000 });
    });

    test('no morph-done class after mode toggle completes', async ({ page }) => {
        const btn = page.locator('#demo-morph-toggle-btn');
        await btn.click();
        await expect(btn.locator('.vd-morph-current')).toContainText('Dark Mode', { timeout: 8000 });
        await page.waitForTimeout(500);
        await expect(btn).not.toHaveClass(/morph-done/);
    });

    test('programmatic morph via VanduoMorph.morph()', async ({ page }) => {
        const btn = page.locator('#demo-morph-toggle-btn');
        await expect(btn.locator('.vd-morph-current')).toContainText('Light Mode');

        await page.evaluate(() => {
            const el = document.querySelector('#demo-morph-toggle-btn') as HTMLElement;
            (window as any).VanduoMorph.morph(el);
        });

        await expect(btn.locator('.vd-morph-current')).toContainText('Dark Mode', { timeout: 8000 });
    });
});

test.describe('Water Morph – Reduced Motion', () => {
    test.slow();

    test('no animation classes linger with prefers-reduced-motion', async ({ browser }) => {
        const context = await browser.newContext({
            reducedMotion: 'reduce'
        });
        const page = await context.newPage();

        await waitForMorphSection(page);

        const btn = page.locator('#demo-morph-toggle-btn');
        await expect(btn).toBeVisible();

        await btn.click();

        await expect(btn.locator('.vd-morph-current')).toContainText('Dark Mode', { timeout: 8000 });
        await expect(btn).not.toHaveClass(/is-morphing/);

        await context.close();
    });
});
