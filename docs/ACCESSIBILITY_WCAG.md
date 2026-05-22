# Accessibility Plan: WCAG 2.1 AA

This checklist now reflects the implemented remediation pass as of May 22, 2026. The major code-level issues below have been addressed; the remaining work is mostly manual verification and optional tooling.

## Remediated In Code

### 1. No skip navigation link — SC 2.4.1 Bypass Blocks
Every page renders a full sticky appbar before main content. Keyboard users must tab through all nav links on every route.
- Implemented in `dashboard-shell.tsx` with a skip link, main landmark, and keyboard-focusable main target.

### 2. Form error states not announced — SC 1.3.1, 3.3.1, 4.1.3
Forms across `login-form.tsx`, `budget-tool.tsx`, `create-semester-form.tsx`, and others show validation errors visually but don't wire `aria-invalid`, `aria-describedby`, or `role="alert"` on error messages. Screen readers never know an error occurred.
- Implemented across the main auth, setup, profile, invite, roster, budget, and reporting flows using `aria-invalid`, `aria-describedby`, and `role="alert"`.

### 3. `final-report-modal.tsx` has no dialog semantics — SC 4.1.2
The modal overlay is a plain `div`. Unlike `end-drawer.tsx`, it's missing `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and focus management.
- Implemented with dialog semantics, labeling, Escape handling, and focus restoration.

### 4. Progress bars are unsemantic — SC 1.3.1, 4.1.2
Goal/debt progress uses `div.fr-progress-track` with a fill child. No `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, or `aria-valuemax`.
- Implemented in `final-report-modal.tsx` with `role="progressbar"` and value attributes.

### 5. No route change announcements — SC 4.1.3
Next.js App Router doesn't auto-announce page transitions. After navigation, focus sits wherever it was and screen readers don't know the page changed.
- Implemented in `dashboard-shell.tsx` with a polite live region that tracks route-title changes.

---

## Additional Remediations Shipped

### 6. `--muted` color contrast likely fails — SC 1.4.3
`#6b7899` on `#f5f6fa` computes to approximately 3.8:1 — below the 4.5:1 AA threshold for normal text. This affects all placeholder text, helper labels, and secondary captions across the app.
- Updated `--muted` to a darker token in `globals.css`.

### 7. Tooltip pattern uses `data-tooltip` only — SC 1.4.13, 4.1.2
Custom CSS tooltips are rendered via pseudo-elements from the `data-tooltip` attribute. They can appear on hover and focus, but they are not exposed semantically to assistive technology.
- Native `title` fallback added to the shared trigger/button usages that still use `data-tooltip`.

### 8. Icon-only buttons need audit — SC 1.1.1, 4.1.2
Many icon-only buttons already have `aria-label`, but this still needs a full pass to ensure every icon button without visible text has a non-empty accessible name.
- Shared and high-risk icon-only buttons were audited and patched during the remediation pass.

### 9. Combobox keyboard interaction needs audit — SC 2.1.1
`create-student-invite-form.tsx` has `role="combobox"` and `role="listbox"` wired up, but needs verification that arrow key navigation, Home/End, and selection via Enter all work correctly per the ARIA Authoring Practices Guide combobox pattern.
- Implemented Arrow Up/Down, Home/End, Enter, Escape, active descendant, and option semantics in `create-student-invite-form.tsx`.

### 10. File upload inputs need audit — SC 1.3.1, 4.1.2
`profile-form.tsx` and `organization-profile-form.tsx` use label-wrapped hidden `<input type="file">` elements. The pattern may be acceptable, but it should be verified for accessible naming and keyboard activation.
- Added keyboard-operable label-button behavior and explicit input/label association for both upload controls.

---

## Remaining Manual Verification

### 11. `prefers-reduced-motion` not respected — SC 2.3.3
Drawer slide-in animations and transitions don't check `@media (prefers-reduced-motion: reduce)`. Add a CSS block to suppress transitions for users who opt out.
- Implemented in `globals.css`, but it should still be verified in browser with the OS setting enabled.

### 12. No unique `<title>` per page — SC 2.4.2
Only a small subset of routes define route-specific metadata today. Generic titles ("ClarkFin") don't help screen reader users orient themselves.
- Implemented for the main auth, setup, dashboard, and student-tool routes.

### 13. Color alone for financial status badges — SC 1.4.1
Badges use accent/teal/amber/danger color variants. These need a text label or icon alongside the color to convey meaning (most appear to already have text — confirm no badge relies on color alone).
- Still worth a manual content audit, but the current badge usages reviewed during remediation include visible text labels.

---

## Optional Tooling

- **`eslint-plugin-jsx-a11y`** — catches most of the above at dev time
- **`axe-core`** via browser extension or `@axe-core/react` — runtime audit during development
- Optionally: `jest-axe` for automated regression testing on component renders

---

## Follow-Up

1. Run a manual keyboard and screen-reader pass on the invite combobox, upload controls, and route announcements.
2. Verify badge content never depends on color alone.
3. Optionally add `eslint-plugin-jsx-a11y` and runtime `axe-core` checks to prevent regressions.

**Code remediation pass complete.** `npm run typecheck` passed after each accessibility change batch.
