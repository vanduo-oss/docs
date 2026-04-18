import { test, expect, type Page } from '@playwright/test';

async function waitForSPA(page: Page) {
    await page.waitForFunction(() => {
        return document.querySelector('#page-view.is-active') !== null && document.querySelector('#page-view .vd-dynamic-loader') === null
            || document.querySelector('#docs-view.is-active') !== null
            || document.querySelector('#docs-landing') !== null;
    }, { timeout: 10000 });
}

async function goToExpandingCards(page: Page) {
    await page.goto('/#docs/expanding-cards');
    await waitForSPA(page);
    await page.waitForSelector('#expanding-cards', { state: 'attached', timeout: 25000 });
    await page.waitForTimeout(400);
}

test.describe('Expanding Cards – Docs Section', () => {
    test.slow();

    test('section loads and photo strip is visible', async ({ page }) => {
        await goToExpandingCards(page);
        await expect(page.locator('#expanding-cards .demo-title')).toContainText('Expanding Cards');
        const strip = page.locator('#expanding-cards .vd-expanding-cards').first();
        await expect(strip).toBeVisible();
        await expect(strip.locator('.vd-expanding-card.is-active')).toHaveCount(1);
    });

    test('clicking second panel moves active state', async ({ page }) => {
        /* Narrow viewports hide panels via responsive CSS; need enough width for 5 columns */
        await page.setViewportSize({ width: 1024, height: 800 });
        await goToExpandingCards(page);
        const strip = page.locator('#expanding-cards .vd-expanding-cards').first();
        const second = strip.locator('.vd-expanding-card').nth(1);
        await expect(second).toBeVisible();
        await second.click();
        await expect(second).toHaveClass(/is-active/);
    });
});

test.describe('Cards – Docs Section', () => {
    test.slow();

    test('cards section exposes glow, glass, and morph demos', async ({ page }) => {
        await page.goto('/#docs/cards');
        await waitForSPA(page);
        await page.waitForSelector('#cards', { state: 'attached', timeout: 25000 });
        await page.waitForTimeout(400);

        await expect(page.locator('#demo-card-glow-hover')).toBeVisible();
        await expect(page.locator('#demo-card-glass')).toBeVisible();
        await expect(page.locator('#demo-card-morph-block')).toBeVisible();
    });
});
