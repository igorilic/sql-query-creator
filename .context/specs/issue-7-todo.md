# Issue #7 — Dark Mode Fix: Todo

> **Ref:** issue-7-bugfix.md (spec), issue-7-issue-context.md (original issue)
>
> **Assumptions:**
> - Dark mode is triggered by `prefers-color-scheme: dark` (Tailwind v4 default media strategy). No manual toggle needed.
> - We match the Catalyst demo's approach (`layout.tsx` classes, `@theme` block) for consistency.
> - Chat-panel migration to Catalyst `Input`/`Button` is in scope since those components provide dark mode for free.
> - CodeMirror dark theme (e.g., `oneDark`) is out of scope — can be a follow-up. The editor area will inherit dark background from parent.
> - Testing dark mode CSS classes: we verify className strings contain expected `dark:` variants. This is the pragmatic approach in jsdom where media queries don't apply. We test that the classes are present, not that they render visually correct.
>
> **Open Questions:**
> - Should CodeMirror get a dedicated dark theme (e.g., `@codemirror/theme-one-dark`)? Deferred to follow-up issue.
> - Should we add a manual theme toggle? Deferred to follow-up issue.

---

## Step 1: Add dark mode foundation to root layout and globals.css

- **Test**: Write `apps/web/src/app/__tests__/layout.test.tsx`:
  - Assert `RootLayout` renders an `<html>` element with className containing: `text-zinc-950`, `antialiased`, `lg:bg-zinc-100`, `dark:bg-zinc-900`, `dark:text-white`, `dark:lg:bg-zinc-950`
  - Assert `<body>` is rendered inside `<html>`
- **Implement**:
  - Update `apps/web/src/app/layout.tsx`: add className to `<html>` matching Catalyst demo pattern
  - Update `apps/web/src/app/globals.css`: add `@theme` block with Inter font config (matching Catalyst demo)
- **Files**:
  - `apps/web/src/app/__tests__/layout.test.tsx` (new)
  - `apps/web/src/app/layout.tsx`
  - `apps/web/src/app/globals.css`
- **Commit**: `test(layout): verify root html has dark mode classes` → `fix(layout): add dark mode foundation classes to root layout and globals.css`

---

## Step 2: Add dark mode classes to schema-browser

- **Test**: Add tests to `apps/web/src/components/__tests__/schema-browser.test.tsx`:
  - Assert empty-state container (`"Connect a database..."`) has className containing `dark:text-zinc-400`
  - Assert column row has className containing `dark:text-zinc-400`
  - Assert data-type span has className containing `dark:text-zinc-500`
  - Assert FK badge has className containing `dark:bg-amber-900/50` and `dark:text-amber-400`
- **Implement**: Update `apps/web/src/components/schema-browser.tsx`:
  - `text-zinc-500` → `text-zinc-500 dark:text-zinc-400` (empty states)
  - `text-zinc-600` → `text-zinc-600 dark:text-zinc-400` (column rows)
  - `text-zinc-400` → `text-zinc-400 dark:text-zinc-500` (data type, FK arrow)
  - `bg-amber-100 ... text-amber-700` → add `dark:bg-amber-900/50 dark:text-amber-400` (FK badge)
- **Files**:
  - `apps/web/src/components/__tests__/schema-browser.test.tsx`
  - `apps/web/src/components/schema-browser.tsx`
- **Commit**: `test(schema-browser): verify dark mode class variants` → `fix(schema-browser): add dark mode color classes`

---

## Step 3: Add dark mode classes to query-editor

- **Test**: Add tests to `apps/web/src/components/__tests__/query-editor.test.tsx`:
  - Assert toolbar div has className containing `dark:border-zinc-700`
  - Assert error alert span has className containing `dark:text-red-400`
- **Implement**: Update `apps/web/src/components/query-editor.tsx`:
  - Toolbar: `border-b` → `border-b border-zinc-200 dark:border-zinc-700`
  - Error text: `text-red-600` → `text-red-600 dark:text-red-400`
- **Files**:
  - `apps/web/src/components/__tests__/query-editor.test.tsx`
  - `apps/web/src/components/query-editor.tsx`
- **Commit**: `test(query-editor): verify dark mode class variants` → `fix(query-editor): add dark mode border and error color classes`

---

## Step 4: Migrate chat-panel to Catalyst components and add dark mode

- **Test**: Update `apps/web/src/components/__tests__/chat-panel.test.tsx`:
  - Add mocks for `@ui/input` and `@ui/button` (similar pattern to query-editor test)
  - Existing tests must continue passing (textbox role, button role, submit behavior)
  - Add test: form container has className containing `dark:border-zinc-700`
  - Add test: message area has className containing `dark:text-zinc-300` or similar for readability
- **Implement**: Update `apps/web/src/components/chat-panel.tsx`:
  - Replace `<input>` with Catalyst `Input` from `@ui/input`
  - Replace `<button>` with Catalyst `Button` from `@ui/button`
  - Update form border: `border-t` → `border-t border-zinc-200 dark:border-zinc-700`
  - Add dark text colors to message articles if needed
- **Files**:
  - `apps/web/src/components/__tests__/chat-panel.test.tsx`
  - `apps/web/src/components/chat-panel.tsx`
- **Commit**: `test(chat-panel): add Catalyst component mocks and dark mode assertions` → `fix(chat-panel): migrate to Catalyst Input/Button and add dark mode classes`

---

## Step 5: Integration test — full dark mode coverage verification

- **Test**: Write `apps/web/src/__tests__/integration/dark-mode.test.tsx`:
  - Render `HomePage` (with all providers/mocks) and verify:
    - No hardcoded light-only border classes without `dark:` counterparts (scan rendered container's innerHTML)
    - Key dark mode classes are present somewhere in the rendered tree
  - Run full test suite: `pnpm test` — all existing tests pass (no regressions)
- **Implement**: No production code changes — test-only step
- **Files**:
  - `apps/web/src/__tests__/integration/dark-mode.test.tsx` (new)
- **Commit**: `test(dark-mode): add integration test verifying dark mode coverage`

---

## Status Checklist

- [x] Step 1: Root layout + globals.css dark mode foundation
- [x] Step 2: schema-browser dark mode classes
- [x] Step 3: query-editor dark mode classes
- [x] Step 4: chat-panel Catalyst migration + dark mode
- [x] Step 5: Integration test + regression check
