import { test, expect, type Page } from '@playwright/test';

async function waitForSPA(page: Page) {
    await page.waitForFunction(() => {
        return document.querySelector('#page-view.is-active') !== null && document.querySelector('#page-view .vd-dynamic-loader') === null
            || document.querySelector('#docs-view.is-active') !== null
            || document.querySelector('#docs-landing') !== null;
    }, { timeout: 10000 });
}

test.describe('Timeline – Docs Section', () => {
    test.slow();

    test('animated timelines reveal items after scroll', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 800 });
        await page.goto('/#docs/timeline');
        await waitForSPA(page);
        await page.waitForSelector('#timeline', { state: 'attached', timeout: 25000 });
        await page.waitForTimeout(400);

        const basic = page.locator('#demo-timeline-basic .vd-timeline.vd-timeline-animated');
        await expect(basic).toBeVisible();
        await basic.scrollIntoViewIfNeeded();

        await expect.poll(async () => {
            return await basic.locator('.vd-timeline-item.is-revealed').count();
        }, { timeout: 15000 }).toBeGreaterThan(0);

        const items = basic.locator('.vd-timeline-item');
        const n = await items.count();
        expect(n).toBeGreaterThan(0);
        for (let i = 0; i < n; i++) {
            await expect(items.nth(i)).toHaveClass(/is-revealed/);
        }
    });

    test('playback demo reveals one item per next click', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 800 });
        await page.goto('/#docs/timeline');
        await waitForSPA(page);
        await page.waitForSelector('#demo-timeline-playback', { state: 'attached', timeout: 25000 });
        await page.waitForTimeout(400);

        const timeline = page.locator('#demo-timeline-playback .vd-timeline-playback');
        await expect(timeline.locator('.vd-timeline-item.is-revealed')).toHaveCount(0);

        await page.locator('#demo-timeline-playback [data-vd-timeline-next]').click();
        await expect(timeline.locator('.vd-timeline-item.is-revealed')).toHaveCount(1);
    });
});
