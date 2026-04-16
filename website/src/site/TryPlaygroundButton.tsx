import Link from "next/link";
import type { FC } from "react";
import { css } from "../styled-system/css";

const wrapperClass = css({
	mt: "5",
	display: "block",
});

const linkClass = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	gap: "2.5",
	p: "4",
	borderRadius: "6px",
	fontSize: "sm",
	fontWeight: "500",
	fontFamily: "body",
	textDecoration: "none",
	borderWidth: "1px",
	borderStyle: "solid",
	transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
	// Light: near-white surface, dark text
	bg: "#ffffff",
	color: "#111827",
	borderColor: "border",
	_dark: {
		// Dark: near-black surface, white text (inverted)
		bg: "#1a1a1a",
		color: "#ffffff",
		borderColor: "border",
	},
	_hover: {
		borderColor: "muted",
	},
	_focusVisible: {
		outline: "2px solid",
		outlineColor: "accent",
		outlineOffset: "2px",
	},
});

function PlayIcon() {
	return (
		<svg
			width={18}
			height={18}
			viewBox="0 0 24 24"
			fill="currentColor"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden>
			<path d="M8 5.2v13.6L19 12 8 5.2Z" />
		</svg>
	);
}

/** MDX: CTA linking to the interactive `/demo` playground. */
export const TryPlaygroundButton: FC = () => (
	<div className={wrapperClass}>
		<Link href="/demo" className={linkClass}>
			<PlayIcon />
			Try playground
		</Link>
	</div>
);
