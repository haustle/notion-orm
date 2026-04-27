import { css } from "../styled-system/css";

/** Typography and spacing for MDX inside `DocsProse` (nested under layout `articleBaseClass`). */
export const docsArticleProseClass = css({
	width: "100%",
	/**
	 * Match `PageToc` + `panda.config` TOC flash: headings animate; inline code in headings
	 * must clear its chip `bg` while `.site-toc-heading-click-flash` runs or the highlight is invisible.
	 */
	"& h1, & h2, & h3, & h4": {
		transition: "background-color 150ms ease, box-shadow 150ms ease",
	},
	"& h1": {
		fontSize: "3xl",
		fontWeight: "700",
		lineHeight: "1.2",
		marginTop: "0",
		marginBottom: "0.5em",
		letterSpacing: "-0.02em",
	},
	"& h2": {
		fontSize: "2xl",
		fontWeight: "600",
		lineHeight: "1.3",
		marginTop: "2em",
		marginBottom: "0.75em",
		scrollMarginTop: "15",
	},
	"& h3": {
		fontSize: "xl",
		fontWeight: "600",
		lineHeight: "1.4",
		marginTop: "1.75em",
		marginBottom: "0.65em",
		scrollMarginTop: "15",
	},
	"& h4": {
		fontSize: "lg",
		fontWeight: "600",
		lineHeight: "1.45",
		marginTop: "1.5em",
		marginBottom: "0.5em",
		scrollMarginTop: "15",
	},
	"& p": {
		marginTop: "0",
		marginBottom: "1.25em",
	},
	"& p:last-child": {
		marginBottom: "0",
	},
	"& a": {
		color: "text",
		textDecoration: "underline",
		textUnderlineOffset: "3px",
	},
	"& ul, & ol": {
		marginTop: "0",
		marginBottom: "1.25em",
		paddingLeft: "1.5em",
	},
	"& li": {
		marginBottom: "0.5em",
	},
	"& ul": {
		listStyleType: "disc",
	},
	"& ol": {
		listStyleType: "decimal",
	},
	"& strong": {
		fontWeight: "600",
	},
	"& hr": {
		marginY: "8",
		border: "none",
		borderTopWidth: "1px",
		borderTopColor: "border",
	},
	"& :not(pre) > code": {
		fontFamily: "mono",
		fontSize: "0.9em",
		bg: "inlineCodeBg",
		color: "inlineCodeText",
		px: "1.5",
		py: "0.5",
		rounded: "md",
		borderWidth: "1px",
		borderColor: "border",
	},
	/**
	 * Stacked API tables (`mdx-components` `StackedTable`): property names stay chipped;
	 * type column is plain monospace + muted color (same specificity as rule above — must follow it).
	 */
	"& [data-docs-prose-plain-code] code": {
		fontFamily: "mono",
		fontSize: "inherit",
		bg: "transparent",
		color: "inherit",
		borderWidth: "0",
		borderColor: "transparent",
		rounded: "none",
		px: "0",
		py: "0",
	},
	"& h1 code, & h2 code, & h3 code, & h4 code": {
		/** `background` (not just `background-color`) matches Panda `bg` and refills the chip after the TOC flash. */
		transition:
			"background 150ms ease, color 150ms ease, box-shadow 150ms ease, border-color 150ms ease",
	},
	/**
	 * Must match `SITE_TOC_HEADING_CLICK_FLASH_CLASS` in `siteClassNames.ts` — static keys only
	 * so Panda extracts these rules (template literals are skipped).
	 */
	"& h1.site-toc-heading-click-flash, & h2.site-toc-heading-click-flash, & h3.site-toc-heading-click-flash, & h4.site-toc-heading-click-flash":
		{
			transition: "none",
		},
	"& h1.site-toc-heading-click-flash code, & h2.site-toc-heading-click-flash code, & h3.site-toc-heading-click-flash code, & h4.site-toc-heading-click-flash code":
		{
			bg: "transparent",
			color: "text",
			/** Avoid a gray 1px ring vs the flash `box-shadow` ring from `panda.config` keyframes. */
			borderColor: "transparent",
			transition: "none",
		},
});
