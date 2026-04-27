/**
 * Canonical string identifiers for global CSS classes, data attributes, and CodeMirror
 * class names used from TypeScript (JSX, Panda `globalCss`, `css()`, DOM APIs).
 */

/** `document.documentElement` — set by `src/app/layout.tsx` theme script; Panda `conditions`. */
export const SITE_COLOR_MODE_ATTR = "data-color-mode" as const;
export const SITE_COLOR_MODE_DARK = "dark" as const;
export const SITE_COLOR_MODE_LIGHT = "light" as const;

export const siteColorModePandaConditions = {
	dark: `[${SITE_COLOR_MODE_ATTR}=${SITE_COLOR_MODE_DARK}] &`,
	light: `[${SITE_COLOR_MODE_ATTR}=${SITE_COLOR_MODE_LIGHT}] &`,
} as const;

/** GitHub link ↗ in `SiteLayout` — JSX data attribute; hover CSS uses the same strings in `SiteLayout`. */
export const PAGE_LINK_ARROW_ATTR = "data-page-link-arrow" as const;
export const PAGE_LINK_ARROW_VALUE = "true" as const;

/**
 * Panda `fonts.mono` as a CSS value — use where `css({ fontFamily: "mono" })` is not available
 * (e.g. CodeMirror `EditorView.theme` objects). Matches `--fonts-mono` from the styled-system.
 */
export const siteMonoFontFamilyCssVar = "var(--fonts-mono)" as const;

/** Demo `/demo` cursor hint — `demoCursorHint.css` + `DemoEditorShortcutsCallout`. */
export const DEMO_CURSOR_HINT_ROW_CLASS = "demo-cursor-hint-row" as const;
export const DEMO_CURSOR_HINT_ICON_CLASS = "demo-cursor-hint-icon" as const;

/**
 * One-shot heading highlight when jumping via sidebar TOC. Styles live in `panda.config.ts`
 * `globalCss` (single class — safe for `classList`); `prefers-reduced-motion` is handled in TS.
 */
export const SITE_TOC_HEADING_CLICK_FLASH_CLASS =
	"site-toc-heading-click-flash" as const;

/** `className` segment for demo Reset buttons; `prefers-reduced-motion` for those controls is in `demoPlaygroundResetButton.css`. */
export const DEMO_PLAYGROUND_RESET_BUTTON_CLASS =
	"demo-playground-reset-btn" as const;

/** `cm-*` strings passed into `EditorView.theme` and the tooltip motion plugin in `DemoPlayground`. */
export const cmDemoSiteClassNames = {
	scroller: "cm-scroller",
	gutters: "cm-gutters",
	content: "cm-content",
	gutter: "cm-gutter",
	line: "cm-line",
	lintMarkerError: "cm-lint-marker-error",
	lintMarkerWarning: "cm-lint-marker-warning",
	lintMarkerInfo: "cm-lint-marker-info",
	diagnosticText: "cm-diagnosticText",
	tooltip: "cm-tooltip",
	tooltipLint: "cm-tooltip-lint",
	tooltipHover: "cm-tooltip-hover",
	tooltipSection: "cm-tooltip-section",
	tooltipAutocomplete: "cm-tooltip-autocomplete",
	tooltipAutocompleteDisabled: "cm-tooltip-autocomplete-disabled",
	completionInfo: "cm-completionInfo",
	tooltipAbove: "cm-tooltip-above",
	tooltipArrow: "cm-tooltip-arrow",
	tooltipBelow: "cm-tooltip-below",
	tooltipMotionEnter: "cm-tooltip-motion-enter",
	tooltipMotionLeave: "cm-tooltip-motion-leave",
	keyframeTooltipIn: "cm-demo-tooltip-in",
	keyframeTooltipOut: "cm-demo-tooltip-out",
} as const;

/** Argument to `querySelector` / `querySelectorAll` in the tooltip motion RAF loop. */
export const cmDemoTooltipQuerySelectorList = `${cmDemoSiteClassNames.tooltip}, ${cmDemoSiteClassNames.tooltipLint}`;
