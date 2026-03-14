# Vanduo Docs QA Strategy & Roadmap

This document tracks the test coverage planning for the `vanduo-docs` site. Since the core `vanduo-framework` is rigorously cross-browser tested, our primary goal here is ensuring the documentation site features (SPA routing, global search, mobile responsiveness, etc.) function flawlessly without bugs. 

**Resource Optimization**: To save time and resources, automated tests for the docs site will run *exclusively* on Chromium (Desktop and Mobile viewports).

## Test Coverage Checklist

### 1. Global Navigation & Layout
- [x] Navbar links load corresponding page views without a full reload.
- [ ] Mobile hamburger menu toggles correctly and displays links. (Skipped on Desktop)
- [x] Theme switcher and ThemeCustomizer reset stay synchronized and update `data-theme` plus shared localStorage state.
- [x] Footer links route properly and open external links in new tabs.
- [x] Back/Forward browser history works seamlessly with the SPA router.

### 2. Search Functionality
- [x] `Cmd+K` keyboard shortcut opens the global search modal (or focuses inline hero search on the homepage).
- [x] Search input accurately filters across multiple sections (e.g., finding "buttons").
- [x] Search keyboard navigation (Up/Down/Enter) works correctly within the modal.
- [x] Clicking a search result navigates to the specific section and closes the modal.
- [x] "No results" state displays correctly.

### 3. Page Views
#### Home View (`#home`)
- [x] Hero section displays correctly.
- [x] Hero search works.
- [x] Links to Docs, GitHub, and specific sections work.

#### About View (`#about`)
- [x] Loads correctly.
- [x] Images (e.g., Founder's message Image Box) open properly.

#### Changelog View (`#changelog`)
- [x] Loads correctly and displays release notes.

### 4. Documentation View (`#docs/…`)
#### Docs Landing (`#docs`)
- [x] Displays the three main cards (Components, Guides, Concepts).
- [x] Cards accurately route to their respective tab views (`#docs/components`, etc.).

#### Components Tab (`#docs/components`)
- [x] Sidebar renders with correct categories (Getting Started, Core, Components, etc.).
- [x] First section loads automatically if navigated directly without a specific section.
- [x] Scrollspy highlights the active section in the sidebar as the user scrolls.
- [ ] Mobile sidebar toggle opens and closes the menu correctly. (Skipped on Desktop)
- [x] In-page section anchors navigate and update hash without breaking state.

#### Guides Tab (`#docs/guides`)
- [x] Sidebar renders specific guides.
- [x] Guide content loads correctly.

#### Concepts Tab (`#docs/concepts`)
- [x] Sidebar renders concepts.
- [x] Concept content loads correctly.

### 5. Interactive Demos & Code Snippets
- [x] Code snippet tabs (HTML, CSS, JS) switch correctly.
- [ ] Code snippet "Copy" button works and updates text state. (**FAILING**)
- [x] Interactive demos (e.g., Draggable, Toast, Modals) within the docs trigger the correct framework components.
