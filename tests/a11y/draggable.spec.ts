import { test, expect } from '@playwright/test';

/* ── Helpers ────────────────────────────────────────── */
async function navigateToDraggable(page: import('@playwright/test').Page) {
    await page.goto('/#docs/draggable');
    // Wait for the SPA engine to boot and load the draggable section
    await page.waitForFunction(() =>
        document.querySelector('#draggable') !== null
        , { timeout: 15000 });
}

/* ── Draggable Documentation Page ───────────────────── */
test.describe('Draggable Docs Page @docs', () => {

    test('loads draggable section via deep link', async ({ page }) => {
        await navigateToDraggable(page);
        await expect(page.locator('#draggable')).toBeVisible();
    });

    test('has section title with correct text', async ({ page }) => {
        await navigateToDraggable(page);
        const title = page.locator('#draggable .demo-title');
        await expect(title).toBeVisible();
        await expect(title).toContainText('Draggable');
    });

    test('renders basic draggable demo', async ({ page }) => {
        await navigateToDraggable(page);
        const draggables = page.locator('#draggable .vd-draggable');
        await expect(draggables.first()).toBeVisible();
        expect(await draggables.count()).toBeGreaterThan(0);
    });

    test('renders vertical container demo', async ({ page }) => {
        await navigateToDraggable(page);
        const container = page.locator('#draggable .vd-draggable-container-vertical');
        await expect(container).toBeVisible();

        const items = container.locator('.vd-draggable-item');
        expect(await items.count()).toBeGreaterThanOrEqual(3);
    });

    test('renders drop zone demo', async ({ page }) => {
        await navigateToDraggable(page);
        const dropZone = page.locator('#draggable .vd-drop-zone');
        await expect(dropZone).toBeVisible();
    });

    test('has keyboard shortcuts table', async ({ page }) => {
        await navigateToDraggable(page);
        // Find the Accessibility card with keyboard table
        const accessibilityCard = page.locator('#draggable .vd-card', { hasText: 'Keyboard Shortcuts' });
        await expect(accessibilityCard).toBeVisible();

        // Table should contain expected keys
        const table = accessibilityCard.locator('.vd-table');
        await expect(table).toBeVisible();
        await expect(table).toContainText('Tab');
        await expect(table).toContainText('Enter');
        await expect(table).toContainText('Escape');
        await expect(table).toContainText('Arrow Up');
    });

    test('has events reference table', async ({ page }) => {
        await navigateToDraggable(page);
        const eventsCard = page.locator('#draggable .vd-card', { hasText: 'Events Reference' });
        await expect(eventsCard).toBeVisible();

        const table = eventsCard.locator('.vd-table');
        await expect(table).toContainText('draggable:start');
        await expect(table).toContainText('draggable:end');
        await expect(table).toContainText('draggable:reorder');
    });

    test('has CSS variables reference table', async ({ page }) => {
        await navigateToDraggable(page);
        const cssCard = page.locator('#draggable .vd-card').filter({
            has: page.locator('h1, h2, h3, h4').filter({ hasText: 'CSS Variables' })
        });
        await expect(cssCard).toBeVisible();

        const table = cssCard.locator('.vd-table');
        await expect(table).toContainText('--draggable-bg');
        await expect(table).toContainText('--drop-zone-bg');
    });

    test('has JavaScript API reference table', async ({ page }) => {
        await navigateToDraggable(page);
        const apiCard = page.locator('#draggable .vd-card').filter({
            has: page.locator('h1, h2, h3, h4').filter({ hasText: 'JavaScript API' })
        });
        await expect(apiCard).toBeVisible();

        const table = apiCard.locator('.vd-table');
        await expect(table).toContainText('makeDraggable');
        await expect(table).toContainText('removeDraggable');
        await expect(table).toContainText('destroyAll');
    });

    test('sidebar lists draggable section', async ({ page }) => {
        await navigateToDraggable(page);
        const sidebarLink = page.locator('.doc-nav-link[data-section="draggable"]');
        // On mobile, the sidebar might be visually hidden off-canvas, so we check if it is attached instead of visible
        await expect(sidebarLink).toBeAttached();
    });

    test('code examples are present', async ({ page }) => {
        await navigateToDraggable(page);
        const codeBlocks = page.locator('#draggable .vd-code-snippet, #draggable pre, #draggable code');
        expect(await codeBlocks.count()).toBeGreaterThan(0);
    });
});
