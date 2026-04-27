import { IconCursor1 } from "@central-icons-react/round-filled-radius-2-stroke-1.5/IconCursor1";
import type { FC, ReactNode } from "react";
import { css, cx } from "../../styled-system/css";
import {
	DEMO_CURSOR_HINT_ICON_CLASS,
	DEMO_CURSOR_HINT_ROW_CLASS,
} from "../siteClassNames";

const stackClass = css({
	mt: "8",
	mb: "0",
	display: "flex",
	flexDirection: "column",
	gap: "5",
});

const rootClass = css({
	borderWidth: "1px",
	borderColor: "border",
	borderRadius: "12px",
	padding: "20px 14px",
	bg: "transparent",
	userSelect: "none",
});

const asideInnerClass = css({
	display: "flex",
	flexDirection: "column",
	gap: "4",
});

const labelClass = css({
	fontFamily: "mono",
	fontSize: "sm",
	color: "muted",
	letterSpacing: "0.08em",
});

const gridClass = css({
	display: "grid",
	gridTemplateColumns: "auto 1fr",
	alignItems: "start",
	columnGap: "60px",
	rowGap: "10px",
	fontSize: "sm",
	lineHeight: "1.28",
	color: "text",
	opacity: 0.85,
});

const shortcutCellClass = css({
	whiteSpace: "nowrap",
});

const descCellClass = css({
	minW: "0",
});

const hoverNoteInnerClass = css({
	display: "flex",
	alignItems: "center",
	gap: "2",
	maxWidth: "100%",
});

const hoverNoteRowClass = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: "100%",
	fontSize: "xs",
	lineHeight: "1.28",
	color: "muted",
	opacity: 0.9,
});

const hoverNoteIconWrapClass = css({
	flexShrink: 0,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	overflow: "visible",
	w: "12px",
	h: "12px",
});

const hoverNoteTextClass = css({
	userSelect: "none",
});

const kbdClass = css({
	fontFamily: "mono",
	fontSize: "0.92em",
	bg: "inlineCodeBg",
	borderWidth: "1px",
	borderColor: "border",
	borderRadius: "4px",
	px: "5px",
	py: "1px",
	whiteSpace: "nowrap",
});

function Kbd({ children }: { children: ReactNode }) {
	return <code className={kbdClass}>{children}</code>;
}

export const DemoEditorShortcutsCallout: FC = () => (
	<div className={stackClass}>
		<aside className={rootClass} aria-label="Code editor keyboard help">
			<div className={asideInnerClass}>
				<div className={labelClass}>Help</div>
				<div className={gridClass}>
					<div className={shortcutCellClass}>
						<Kbd>Ctrl+Space</Kbd>
					</div>
					<div className={descCellClass}>Trigger completions menu</div>

					<div className={shortcutCellClass}>
						<Kbd>Cmd/Ctrl+Z</Kbd>
					</div>
					<div className={descCellClass}>Undo</div>

					<div className={shortcutCellClass}>
						<Kbd>Cmd/Ctrl+Shift+Z</Kbd>
					</div>
					<div className={descCellClass}>Redo</div>

					<div className={shortcutCellClass}>
						<Kbd>Cmd/Ctrl+S</Kbd>
					</div>
					<div className={descCellClass}>Format with Prettier</div>

					<div className={shortcutCellClass}>
						<Kbd>Tab</Kbd>
					</div>
					<div className={descCellClass}>Indent</div>

					<div className={shortcutCellClass}>
						<Kbd>Shift+Tab</Kbd>
					</div>
					<div className={descCellClass}>Outdent</div>
				</div>
			</div>
		</aside>
		<div className={cx(hoverNoteRowClass, DEMO_CURSOR_HINT_ROW_CLASS)}>
			<div className={hoverNoteInnerClass}>
				<span
					className={cx(hoverNoteIconWrapClass, DEMO_CURSOR_HINT_ICON_CLASS)}
					aria-hidden>
					<IconCursor1 size={12} />
				</span>
				<span className={hoverNoteTextClass}>
					Hover code to see types and error diagnostics
				</span>
			</div>
		</div>
	</div>
);
