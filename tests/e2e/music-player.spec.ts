/**
 * Music Player — Docs E2E Tests @e2e
 *
 * Verifies that the Music Player documentation page loads correctly,
 * all demo cards render, code snippet collapsibles work, and the
 * Stellardrone attribution card is present.
 *
 * Note: Actual audio playback is not tested (requires media files).
 */

import { test, expect } from '@playwright/test';

async function waitForSPA(page: import('@playwright/test').Page) {
    await page.waitForFunction(
        () =>
            document.querySelector('#page-view.is-active') !== null &&
                document.querySelector('#page-view .vd-dynamic-loader') === null ||
            document.querySelector('#docs-view.is-active') !== null ||
            document.querySelector('#docs-landing') !== null,
        { timeout: 10000 },
    );
}

async function gotoMusicPlayer(page: import('@playwright/test').Page) {
    await page.goto('/#docs/music-player', { waitUntil: 'networkidle' });
    await waitForSPA(page);
    await page.waitForSelector('#music-player', { state: 'visible', timeout: 10000 });
    await page.waitForFunction(() => {
        const snippets = [...document.querySelectorAll('#music-player .vd-code-snippet[data-collapsible]')];
        const snippet = snippets.find((el) => el.textContent?.includes('View ESM / bundler import'));
        return snippet?.dataset.initialized === 'true'
            && (snippet._codeSnippetCleanup?.length ?? 0) > 0;
    }, { timeout: 15000 });
}

/** Install block is expanded by default; target the ESM import snippet by label. */
function esmImportCodeSnippet(page: import('@playwright/test').Page) {
    return page.locator('#music-player .vd-code-snippet[data-collapsible]', {
        hasText: 'View ESM / bundler import',
    });
}

test.describe('Music Player Docs Page @e2e', () => {
    test('navigates to music-player section without errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(err.message));
        await gotoMusicPlayer(page);
        expect(errors).toHaveLength(0);
    });

    test('section heading is visible', async ({ page }) => {
        await gotoMusicPlayer(page);
        const heading = page.locator('#music-player h5.demo-title');
        await expect(heading).toBeVisible();
        await expect(heading).toContainText('Music Player');
    });

    test('Minimal Player demo card renders', async ({ page }) => {
        await gotoMusicPlayer(page);
        const section = page.locator('#music-player');
        await expect(section.locator('#demo-minimal')).toBeAttached();
        await expect(section.locator('#demo-minimal')).toHaveAttribute(
            'data-music-player-initialized',
            'true',
        );
    });

    test('With Progress Bar demo card renders', async ({ page }) => {
        await gotoMusicPlayer(page);
        await expect(page.locator('#demo-progress')).toHaveAttribute(
            'data-music-player-initialized',
            'true',
        );
        await expect(page.locator('#demo-progress .vd-music-player-progress')).toBeAttached();
    });

    test('install section shows package name', async ({ page }) => {
        await gotoMusicPlayer(page);
        await expect(page.locator('#music-player')).toContainText('@vanduo-oss/music-player');
    });

    test('With Playlist + Progress demo renders', async ({ page }) => {
        await gotoMusicPlayer(page);
        await expect(page.locator('#demo-playlist')).toHaveAttribute(
            'data-music-player-initialized',
            'true',
        );
        await expect(
            page.locator('#demo-playlist .vd-music-player-btn-playlist'),
        ).toBeVisible();
        await expect(page.locator('#demo-playlist .vd-music-player-progress')).toBeAttached();
    });

    test('Inline all-features demo renders', async ({ page }) => {
        await gotoMusicPlayer(page);
        await expect(page.locator('#demo-inline')).toHaveAttribute(
            'data-music-player-initialized',
            'true',
        );
    });

    test('theme-specific docs demos are removed', async ({ page }) => {
        await gotoMusicPlayer(page);
        await expect(page.locator('#demo-neutral')).not.toBeAttached();
        await expect(page.locator('#demo-dark')).not.toBeAttached();
    });

    test('size variant demos render', async ({ page }) => {
        await gotoMusicPlayer(page);
        await expect(page.locator('#demo-sm')).toHaveClass(/vd-music-player-sm/);
        await expect(page.locator('#demo-lg')).toHaveClass(/vd-music-player-lg/);
        await expect(page.locator('#demo-compact')).toHaveClass(/vd-music-player-compact/);
    });

    test('play button is visible on minimal demo', async ({ page }) => {
        await gotoMusicPlayer(page);
        await expect(
            page.locator('#demo-minimal .vd-music-player-btn-play'),
        ).toBeVisible();
    });

    test('clicking play button on minimal demo responds', async ({ page }) => {
        await gotoMusicPlayer(page);
        const btn = page.locator('#demo-minimal .vd-music-player-btn-play');
        await btn.click();
        // Button should still be present after click (no errors)
        await expect(btn).toBeVisible();
    });

    test('code snippet collapsible expands on click', async ({ page }) => {
        await gotoMusicPlayer(page);
        const snippet = esmImportCodeSnippet(page);
        const toggle = snippet.locator('.vd-code-snippet-toggle');
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await toggle.scrollIntoViewIfNeeded();
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    test('code snippet HTML tab is active by default', async ({ page }) => {
        await gotoMusicPlayer(page);
        const snippet = page
            .locator('#music-player .vd-code-snippet[data-collapsible]')
            .filter({ has: page.locator('.vd-code-snippet-tab[data-lang="html"]') })
            .first();
        const toggle = snippet.locator('.vd-code-snippet-toggle');
        await toggle.click();
        const htmlTab = snippet.locator('.vd-code-snippet-tab[data-lang="html"]');
        await expect(htmlTab).toHaveClass(/is-active/);
    });

    test('Stellardrone attribution card is present', async ({ page }) => {
        await gotoMusicPlayer(page);
        const link = page.locator('#music-player a[href*="stellardrone"]').first();
        await expect(link).toBeVisible();
        await expect(link).toContainText('Stellardrone');
    });

    test('Options Reference table is present', async ({ page }) => {
        await gotoMusicPlayer(page);
        const table = page.locator('#music-player .vd-table').first();
        await expect(table).toBeVisible();
        // Verify key options appear in the table
        await expect(table).toContainText('tracks');
        await expect(table).toContainText('showProgress');
        await expect(table).toContainText('showPlaylist');
        await expect(table).toContainText('autoAdvance');
    });

    test('appears in sidebar search results', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(500);
        const searchInput = page.locator('#doc-search-input, [data-doc-search] input').first();
        if (await searchInput.isVisible()) {
            await searchInput.fill('music player');
            await page.waitForTimeout(300);
            const result = page.locator('[data-result-id="music-player"], .search-result').first();
            await expect(result).toBeVisible();
        }
    });
});
