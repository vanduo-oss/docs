# Vanduo Docs

Documentation and website for Vanduo, served at https://vanduo.dev.

Framework repo: https://github.com/vanduo-oss/framework
NPM Package: https://www.npmjs.com/package/@vanduo-oss/framework

## Current Snapshot

- Docs are aligned with the v1.2.8 release surface.
- The live docs shell now loads the pinned framework CDN bundle from `@v1.2.8` instead of the locally vendored `dist/` copy.
- Theme tooling is documented as two separate components: Theme Switcher for lightweight system/light/dark toggles and Theme Customizer for full palette, neutral, radius, and font control.
- The docs UI and release-facing copy were refreshed during the v1.2.8 pre-release pass.

## Installation

**We strongly recommend using [pnpm](https://pnpm.io/)**. The Vanduo ecosystem uses strict `.npmrc` security policies for dependency isolation and lockfile enforcement.

```bash
pnpm add @vanduo-oss/framework
```

## Local preview

Open index.html directly or run a simple static server.

## Validation

```bash
pnpm test
```