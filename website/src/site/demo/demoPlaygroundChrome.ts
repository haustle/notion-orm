import { css } from "../../styled-system/css";

export const playgroundWrapperClass = css({
	mt: "8",
	mb: "0",
	bg: "transparent",
});

export const playgroundSectionGapClass = css({
	mt: "10",
});

export const playgroundHeaderClass = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	px: "4",
	py: "2.5",
	bg: "transparent",
	fontSize: "xs",
	color: "muted",
	letterSpacing: "0.08em",
});

export const playgroundFileLabelClass = css({
	fontFamily: "mono",
	fontSize: "xs",
	color: "text",
	fontWeight: "500",
});

export const playgroundHeaderTitleGroupClass = css({
	display: "flex",
	alignItems: "baseline",
	gap: "2",
	flexWrap: "wrap",
	minW: "0",
});

export const playgroundHeaderBulletClass = css({
	color: "muted",
	userSelect: "none",
});

export const playgroundApiReferenceLinkClass = css({
	fontFamily: "inherit",
	fontSize: "xs",
	color: "muted",
	textDecoration: "underline",
	textUnderlineOffset: "2px",
	letterSpacing: "0.06em",
	_hover: {
		color: "text",
	},
});

/** Layout for Example/Schema control (label + icon); pair with `playgroundNotionSchemaToggleButtonClass` on one `<button>`. */
export const playgroundExampleSchemaSwitchRowClass = css({
	display: "inline-flex",
	alignItems: "center",
	gap: "2",
	flexShrink: "0",
	lineHeight: "1",
});

/** Current mode name: "Example" or "Schema" — left of the icon in the switch row. */
export const playgroundExampleSchemaModeLabelClass = css({
	display: "inline-flex",
	alignItems: "center",
	fontFamily: "mono",
	fontSize: "xs",
	letterSpacing: "0.06em",
	userSelect: "none",
	color: "text",
	fontWeight: "500",
	lineHeight: "1",
});

/** Example/Schema switch: interactive styles (full row when combined with `playgroundExampleSchemaSwitchRowClass`). */
export const playgroundNotionSchemaToggleButtonClass = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	flexShrink: "0",
	m: "0",
	p: "0",
	color: "muted",
	backgroundColor: "transparent",
	border: "none",
	cursor: "pointer",
	transition: "color 0.15s, opacity 0.15s",
	_hover: {
		color: "text",
	},
	_disabled: {
		opacity: "0.45",
		cursor: "not-allowed",
	},
	"& svg": {
		w: "4.5",
		h: "4.5",
		display: "block",
		flexShrink: "0",
	},
});

export const playgroundHeaderActionsClass = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	flexWrap: "wrap",
	gap: "3",
});

export const playgroundResetButtonClass = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	color: "muted",
	backgroundColor: "transparent",
	border: "none",
	borderRadius: "6px",
	p: "1.5",
	cursor: "pointer",
	transformOrigin: "center",
	transform: "scale(1)",
	transition:
		"background-color 0.15s, color 0.15s, transform 0.22s cubic-bezier(0.34, 1.45, 0.64, 1)",
	_hover: {
		color: "text",
		backgroundColor: "background",
		transform: "scale(1.05)",
	},
	_active: {
		transform: "scale(0.96)",
		transition:
			"background-color 0.15s, color 0.15s, transform 0.1s cubic-bezier(0.34, 1.8, 0.64, 1)",
	},
	_disabled: {
		opacity: "0.45",
		cursor: "not-allowed",
		transform: "scale(1)",
	},
	"& svg": {
		w: "4",
		h: "4",
		display: "block",
		flexShrink: "0",
	},
});

export const playgroundEditorContainerClass = css({
	position: "relative",
	bg: "background",
	borderWidth: "1px",
	borderColor: "border",
	borderRadius: "12px",
	overflow: "hidden",
});

export const playgroundEditorContainerPlaceholderClass = css({
	minHeight: "480px",
});

export const playgroundLoadingOverlayClass = css({
	position: "absolute",
	inset: "0",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	bg: "background",
	color: "muted",
	fontFamily: "mono",
	fontSize: "sm",
	zIndex: 2,
});

export const demoPlaygroundPanels = {
	databases: {
		label: "Databases",
		resetAriaLabel: "Reset database demo to default code",
		apiReferenceHref: "/api-reference#database-client",
		apiReferenceAriaLabel: "Database client API reference",
		sectionGap: false,
	},
	notionOrm: {
		label: "Notion ORM",
		resetAriaLabel: "Reset Notion ORM multi-database demo to default code",
		apiReferenceHref: "/api-reference#generated-code-layout",
		apiReferenceAriaLabel: "Generated Notion code layout (NotionORM entry)",
		sectionGap: false,
	},
	agents: {
		label: "Agents",
		resetAriaLabel: "Reset agent demo to default code",
		apiReferenceHref: "/api-reference#agent-client",
		apiReferenceAriaLabel: "Agent client API reference",
		sectionGap: true,
	},
} as const;

/** Stable column order for the demo playground (labels alone are not unique keys across refactors). */
export const demoPlaygroundPanelOrder = [
	"databases",
	"notionOrm",
	"agents",
] as const satisfies readonly (keyof typeof demoPlaygroundPanels)[];
