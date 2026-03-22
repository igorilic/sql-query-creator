# Issue #7 — Dark Mode Incompatibility with Catalyst UI Kit

## Problem Statement

The application UI is not compatible with the dark mode of the Catalyst UI kit. When the user's OS or browser prefers dark mode (`prefers-color-scheme: dark`), the Catalyst components render their dark variants (190 `dark:` utility classes across 26 component files), but the application's own layout and custom elements remain styled for light mode only. This creates an unreadable, broken visual experience with dark component backgrounds against light text, missing dark borders, and invisible content areas.

## Root Cause Analysis

There are **three** interrelated root causes:

### 1. Missing dark mode classes on `<html>` element

The Catalyst demo's `layout.tsx` applies foundational dark mode classes to `<html>`:
```tsx
<html className="text-zinc-950 antialiased lg:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:lg:bg-zinc-950">
```

Our `apps/web/src/app/layout.tsx` has:
```tsx
<html lang="en">
  <body>
```

No base text color, no background color, no dark mode variants. The root element provides no dark theme foundation for the rest of the UI.

### 2. Hardcoded light-only colors in application components

Custom styles in our components use light-only Tailwind classes with no `dark:` counterparts:

| File | Light-only classes |
|---|---|
| `schema-browser.tsx` | `text-zinc-500`, `text-zinc-600`, `text-zinc-400`, `bg-amber-100`, `text-amber-700` |
| `chat-panel.tsx` | `border-t`, `border` (default zinc border — invisible on dark bg), plain `<input>` and `<button>` with no dark styling |
| `query-editor.tsx` | `border-b`, `text-red-600` |

These become unreadable against dark backgrounds because:
- `text-zinc-500`/`text-zinc-600` are mid-gray on white but nearly invisible on dark surfaces
- `bg-amber-100` (FK badge) clashes with dark backgrounds
- Native `border` color is light gray, invisible on dark

### 3. Chat panel uses raw HTML elements instead of Catalyst components

`chat-panel.tsx` uses plain `<input>`, `<button>`, and `<form>` elements with manual Tailwind classes instead of Catalyst's `Input`, `Button`, and other components that already include dark mode support. This means the chat area gets no dark mode styling at all.

## Affected Files

| File | Issue |
|---|---|
| `apps/web/src/app/layout.tsx` | Missing dark mode classes on `<html>` |
| `apps/web/src/app/globals.css` | No dark-mode base styles or theme config |
| `apps/web/src/components/chat-panel.tsx` | Raw HTML elements, hardcoded light-only classes |
| `apps/web/src/components/schema-browser.tsx` | Hardcoded light-only text/badge colors |
| `apps/web/src/components/query-editor.tsx` | Hardcoded light-only border/error colors |

## Evidence

### From Catalyst UI Kit (reference implementation)

- **190 `dark:` utility classes** across 26 Catalyst component files (`catalyst-ui-kit/typescript/`)
- The demo `layout.tsx` at `catalyst-ui-kit/demo/typescript/src/app/layout.tsx` sets root dark mode classes
- `SidebarLayout` (used by our app) contains `dark:bg-zinc-900 dark:lg:bg-zinc-950` and `dark:lg:bg-zinc-900 dark:lg:ring-white/10`
- Catalyst `Sidebar`, `Navbar`, `Badge`, `Button`, `Dialog`, `Input`, `Select` all have dark mode variants built in

### From Application Code

- `apps/web/src/app/layout.tsx` — bare `<html lang="en">`, zero dark classes
- `apps/web/src/app/globals.css` — only `@import "tailwindcss"`, no `@theme` block, no font config
- `apps/web/src/components/chat-panel.tsx` — uses `<input>` and `<button>` instead of Catalyst `Input`/`Button`
- Zero `dark:` classes across all files in `apps/web/src/` (grep confirms 0 occurrences)

### From Git History

- No dark mode work has ever been done — the initial `feat: init` commit (54be571) and all subsequent feature commits used light-only classes
- The SidebarLayout was adopted in commit 3961206 but without matching the demo's root layout dark mode setup

## Recommended Fix Approach

1. **Add dark mode foundation to root layout** — Apply the same `<html>` className pattern from the Catalyst demo: `text-zinc-950 antialiased lg:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:lg:bg-zinc-950`
2. **Add `@theme` block to globals.css** — Match Catalyst demo's font configuration
3. **Add `dark:` counterparts to all hardcoded colors** in schema-browser, query-editor, and chat-panel
4. **Replace raw HTML elements in chat-panel with Catalyst components** — Use `Input`, `Button` from `@ui/` to get dark mode for free
5. **Add CodeMirror dark theme toggle** — Use `@uiw/codemirror-theme-*` or media query to switch editor theme

## Assumptions

- Dark mode is triggered via CSS `prefers-color-scheme: dark` (Tailwind v4 default), not a manual toggle. The Catalyst kit uses Tailwind's built-in `dark:` variant which defaults to media query strategy.
- The screenshot in the GitHub issue shows the app in a dark-mode browser/OS with visually broken rendering.
- We should match the Catalyst demo's approach exactly for consistency, not invent a custom dark mode solution.
- No theme toggle UI is needed in this fix — just proper support for system dark mode preference.

## Open Questions

- **Theme toggle**: Should we add a manual light/dark/system toggle in the header? (Not in scope for this fix — can be a follow-up issue)
- **CodeMirror theme**: Should the SQL editor use a specific dark theme (e.g., `oneDark`) or just invert via CSS? Recommend `oneDark` from `@codemirror/theme-one-dark` for best readability.
