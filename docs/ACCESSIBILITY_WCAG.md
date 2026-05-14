# Accessibility Plan: WCAG 2.1 AA

## Critical Gaps (Blockers for compliance)

### 1. No skip navigation link — SC 2.4.1 Bypass Blocks
Every page renders a full sticky appbar before main content. Keyboard users must tab through all nav links on every route.
- Add `<a href="#main-content">Skip to main content</a>` as first child of `<body>` in `dashboard-shell.tsx`, and add `id="main-content"` to the `<main>` element.

### 2. Form error states not announced — SC 1.3.1, 3.3.1, 4.1.3
Forms across `login-form.tsx`, `budget-tool.tsx`, `create-semester-form.tsx`, and others show validation errors visually but don't wire `aria-invalid`, `aria-describedby`, or `role="alert"` on error messages. Screen readers never know an error occurred.
- Add `aria-invalid="true"` + `aria-describedby="field-error-id"` to failing inputs
- Wrap error messages in `<span role="alert">` or an `aria-live="assertive"` region

### 3. `final-report-modal.tsx` has no dialog semantics — SC 4.1.2
The modal overlay is a plain `div`. Unlike `end-drawer.tsx`, it's missing `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and focus management.
- Refactor to match the `EndDrawer` pattern already used elsewhere in the app

### 4. Progress bars are unsemantic — SC 1.3.1, 4.1.2
Goal/debt progress uses `div.fr-progress-track` with a fill child. No `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, or `aria-valuemax`.
- Add ARIA role and value attributes to every progress visualization

### 5. No route change announcements — SC 4.1.3
Next.js App Router doesn't auto-announce page transitions. After navigation, focus sits wherever it was and screen readers don't know the page changed.
- Add a `role="status"` live region in `dashboard-shell.tsx` that updates with the new page title on route change

---

## Significant Issues (Should fix for AA)

### 6. `--muted` color contrast likely fails — SC 1.4.3
`#6b7899` on `#f5f6fa` computes to approximately 3.8:1 — below the 4.5:1 AA threshold for normal text. This affects all placeholder text, helper labels, and secondary captions across the app.
- Darken `--muted` to `#5a6480` or similar (verify with a contrast checker)

### 7. Tooltip pattern uses `data-tooltip` only — SC 1.4.13, 2.1.1
Custom CSS tooltips triggered by `data-tooltip` attribute are CSS-only and not keyboard accessible — they only show on hover, not focus.
- Replace with a proper `<span role="tooltip" id="…">` + `aria-describedby` pattern, or use the native `title` attribute as a fallback

### 8. Icon-only buttons need audit — SC 1.1.1, 4.1.2
Edit (pencil), delete (trash), and copy icon buttons exist throughout `student-roster-manager.tsx`, `budget-tool.tsx`, etc. Some have `aria-label`, but this needs a full pass to ensure every icon button without visible text has a non-empty `aria-label`.

### 9. Combobox keyboard interaction incomplete — SC 2.1.1
`create-student-invite-form.tsx` has `role="combobox"` and `role="listbox"` wired up, but needs verification that arrow key navigation, Home/End, and selection via Enter all work correctly per the ARIA Authoring Practices Guide combobox pattern.

### 10. File upload inputs — SC 1.3.1, 4.1.2
`profile-form.tsx` and `organization-profile-form.tsx` use label-wrapped hidden `<input type="file">` elements. Ensure the visible label text is the accessible name and that activation via Enter/Space on the label works correctly.

---

## Minor Issues (Nice to have for AA)

### 11. No `lang` attribute on `<html>` — SC 3.1.1
Add `lang="en"` to the root layout.

### 12. `prefers-reduced-motion` not respected — SC 2.3.3
Drawer slide-in animations and transitions don't check `@media (prefers-reduced-motion: reduce)`. Add a CSS block to suppress transitions for users who opt out.

### 13. No unique `<title>` per page — SC 2.4.2
Verify each Next.js page exports a unique, descriptive `metadata.title`. Generic titles ("ClarkFin") don't help screen reader users orient themselves.

### 14. Color alone for financial status badges — SC 1.4.1
Badges use accent/teal/amber/danger color variants. These need a text label or icon alongside the color to convey meaning (most appear to already have text — confirm no badge relies on color alone).

---

## Tooling to Add

- **`eslint-plugin-jsx-a11y`** — catches most of the above at dev time
- **`axe-core`** via browser extension or `@axe-core/react` — runtime audit during development
- Optionally: `jest-axe` for automated regression testing on component renders

---

## Summary by Effort

| Priority | Issue | Effort |
|---|---|---|
| Critical | Skip link | ~30 min |
| Critical | Form error ARIA | ~2–3 hrs (many forms) |
| Critical | FinalReportModal dialog semantics | ~1 hr |
| Critical | Progress bar ARIA | ~1 hr |
| Critical | Route change announcements | ~1 hr |
| High | `--muted` contrast fix | ~15 min |
| High | Tooltip keyboard access | ~2 hrs |
| High | Icon button audit | ~1 hr |
| High | Combobox keyboard nav | ~1 hr |
| Medium | File input labels | ~30 min |
| Low | `lang` attribute | 5 min |
| Low | `prefers-reduced-motion` | ~30 min |
| Low | Page titles | ~30 min |
| Low | Badge color audit | ~30 min |

**Total estimated remediation: ~12–15 hours.** The five critical items alone would get the app to a defensible baseline.
