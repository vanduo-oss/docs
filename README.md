# Vanduo Docs

Documentation and website for Vanduo, served at https://vanduo.dev.

Framework repo: https://github.com/vanduo-oss/framework
NPM Package: https://www.npmjs.com/package/@vanduo-oss/framework

## Current Snapshot

- Docs are aligned with the v1.2.8 release surface.
- Production docs load the pinned framework CDN bundle from `@v1.2.8`, while local preview resolves framework assets from `./dist` and refreshes them from the sibling framework repo when available.
- Theme tooling is documented as two separate components: Theme Switcher for lightweight system/light/dark toggles and Theme Customizer for full palette, neutral, radius, and font control.
- The docs UI and release-facing copy were refreshed during the v1.2.8 pre-release pass.

## Installation

**We strongly recommend using [pnpm](https://pnpm.io/)**. The Vanduo ecosystem uses strict `.npmrc` security policies for dependency isolation and lockfile enforcement.

```bash
pnpm add @vanduo-oss/framework
```

## Local preview

Use the local preview script so the docs shell resolves framework assets from `./dist` instead of the published CDN bundle.

```bash
pnpm run preview:local
```

When the sibling `../vanduo-framework` repo is present, the preview script refreshes `vanduo-docs/dist` from `../vanduo-framework/dist` before serving the site. If the framework repo is unavailable, the script falls back to the vendored `dist/` copy already tracked in this repo.

To refresh the local framework assets without starting the server:

```bash
pnpm run sync:framework
```

For a direct `file://` preview, run the sync step first so the local `dist/` assets match the latest framework build.

## Validation

```bash
pnpm test
```