import { test, expect } from '@playwright/test';

/* ── Helpers ────────────────────────────────────────── */
async function waitForSPA(page: import('@playwright/test').Page) {
  // Wait for the SPA engine to boot (registry loaded, first view rendered)
  await page.waitForFunction(() => {
    return (document.querySelector('#page-view.is-active') !== null && document.querySelector('#page-view .vd-dynamic-loader') === null)
      || document.querySelector('#docs-view.is-active') !== null;
  }, { timeout: 10000 });
}

async function clickNavLink(page: import('@playwright/test').Page, route: string) {
  // On mobile/tablet the navbar menu is behind a hamburger toggle
  const toggle = page.locator('.vd-navbar-toggle');
  if (await toggle.isVisible()) {
    await toggle.click();
    await page.waitForTimeout(300);
  }
  await page.locator(`.vd-nav-link[data-route="${route}"]`).click();
}

/* ── Home view ──────────────────────────────────────── */
test.describe('SPA Home @a11y', () => {
  test('loads home view by default', async ({ page }) => {
    await page.goto('/');
    await waitForSPA(page);

    // Page view should be active
    await expect(page.locator('#page-view.is-active')).toHaveCount(1);
    // Home section should be rendered
    await expect(page.locator('#home')).toBeVisible();
  });

  test('navbar links navigate without page reload', async ({ page }) => {
    await page.goto('/');
    await waitForSPA(page);

    // Click Documentation link (handles hamburger menu on mobile)
    await clickNavLink(page, 'docs');
    await page.waitForFunction(() =>
      document.querySelector('#docs-landing') !== null
      , { timeout: 5000 });

    // Page view should remain active, but now showing docs-landing
    await expect(page.locator('#docs-landing')).toBeVisible();
    await expect(page.locator('#docs-view.is-active')).toHaveCount(0);
  });
});

/* ── Documentation view ─────────────────────────────── */
test.describe('SPA Documentation @a11y', () => {

  test('sidebar includes expected component sections', async ({ page }) => {
    await page.goto('/#docs/components');
    await waitForSPA(page);

    const expectedSections = ['navbar', 'sidenav', 'footer', 'code-snippet'];
    for (const id of expectedSections) {
      await expect(page.locator(`.doc-nav-link[data-section="${id}"]`)).toHaveCount(1);
    }
  });

  test('tab switching loads concepts sidebar', async ({ page }) => {
    await page.goto('/#docs/components');
    await waitForSPA(page);

    // Switch to Concepts tab
    await page.locator('.doc-tab[data-tab="concepts"]').click();
    await page.waitForFunction(() =>
      document.querySelector('.doc-tab[data-tab="concepts"].active') !== null
      , { timeout: 5000 });

    // Sidebar should have concepts sections
    await expect(page.locator('.doc-nav-link[data-section="philosophy"]')).toHaveCount(1);
    await expect(page.locator('.doc-nav-link[data-section="namespacing"]')).toHaveCount(1);
  });

  test('deep link to section loads correct tab and section', async ({ page }) => {
    await page.goto('/#docs/buttons');
    await waitForSPA(page);

    // Docs view active
    await expect(page.locator('#docs-view.is-active')).toHaveCount(1);

    // Components tab active
    await expect(page.locator('.doc-tab[data-tab="components"].active')).toHaveCount(1);

    // Buttons section should be loaded
    await expect(page.locator('#buttons')).toBeVisible({ timeout: 10000 });
  });

  test('deep link to concepts section activates concepts tab', async ({ page }) => {
    await page.goto('/#docs/philosophy');
    await waitForSPA(page);

    // Concepts tab active
    await expect(page.locator('.doc-tab[data-tab="concepts"].active')).toHaveCount(1);

    // Philosophy section loaded
    await expect(page.locator('#philosophy')).toBeVisible({ timeout: 10000 });
  });
});

/* ── Theme customizer ───────────────────────────────── */
test.describe('Theme Customizer @a11y', () => {
  test('theme customizer includes all font options', async ({ page, viewport }) => {
    test.skip(viewport !== null && viewport.width < 1024,
      'Theme customizer trigger not accessible on small viewports');

    await page.goto('/');
    await waitForSPA(page);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);

    const trigger = page.locator('[data-theme-customizer-trigger]');
    await trigger.click();

    // Wait for the customizer panel to fully open — use the visible combobox
    const fontSelect = page.getByRole('combobox');
    await expect(fontSelect).toBeVisible({ timeout: 10000 });

    const options = await fontSelect.locator('option').allTextContents();
    expect(options).toContain('Ubuntu');
    expect(options).toContain('Open Sans');
    expect(options).toContain('Rubik');
    expect(options).toContain('Titillium Web');
  });
});

/* ── Changelog & About views ────────────────────────── */
test.describe('SPA Page Views @a11y', () => {
  test('changelog view loads dynamically', async ({ page }) => {
    await page.goto('/#changelog');
    await waitForSPA(page);

    await expect(page.locator('#page-view.is-active')).toHaveCount(1);
    await expect(page.locator('#changelog')).toBeVisible({ timeout: 10000 });
  });

  test('about view loads dynamically', async ({ page }) => {
    await page.goto('/#about');
    await waitForSPA(page);

    await expect(page.locator('#page-view.is-active')).toHaveCount(1);
    await expect(page.locator('#about')).toBeVisible({ timeout: 10000 });
  });

  test('back/forward navigation works', async ({ page }) => {
    await page.goto('/#home');
    await waitForSPA(page);
    await expect(page.locator('#home')).toBeVisible();

    // Navigate to docs (handles hamburger menu on mobile)
    await clickNavLink(page, 'docs');
    await page.waitForFunction(() =>
      document.querySelector('#docs-landing') !== null
      , { timeout: 5000 });

    // Go back
    await page.goBack();
    await page.waitForFunction(() =>
      document.querySelector('#home') !== null
      , { timeout: 5000 });
    await expect(page.locator('#home')).toBeVisible();
  });
});
