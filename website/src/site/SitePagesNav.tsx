"use client";

import { useRouter } from "next/navigation";
import { memo, type MouseEvent } from "react";
import { css, cx } from "../styled-system/css";
import { githubUrl } from "./config";
import {
	PAGE_LINK_ARROW_ATTR,
	PAGE_LINK_ARROW_VALUE,
} from "./siteClassNames";
import type { SitePage, SitePath } from "./types";

type SiteNavPage = Pick<SitePage, "path" | "title">;

export interface SitePagesNavProps {
	sitePages: SiteNavPage[];
	currentPath: SitePath | "";
}

const pagesNavClass = css({
	display: "flex",
	flexDirection: "column",
	gap: "1",
	bg: { _dark: "bgDark" },
	rounded: "10",
	p: "3",
	flexShrink: "0",
});

const pageLinkBaseClass = css({
	display: "inline-flex",
	alignItems: "center",
	gap: "2",
	py: "1",
	fontSize: "sm",
	lineHeight: "1.5",
	fontWeight: "400",
	color: { base: "text", _dark: "white" },
	textDecoration: "none",
	transitionProperty: "opacity",
	transitionDuration: "220ms",
	_hover: { opacity: 1 },
});

const pageLinkActiveClass = css({
	opacity: 1,
});

const pageLinkInactiveClass = css({
	opacity: 0.6,
});

const pageLinkAdornmentClass = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
});

const pageLinkDotClass = css({
	w: "1.5",
	h: "1.5",
	rounded: "full",
	bg: { base: "textLight", _dark: "white" },
});

function isPlainLeftClick(e: MouseEvent<HTMLAnchorElement>): boolean {
	if (e.defaultPrevented) {
		return false;
	}
	if (e.button !== 0) {
		return false;
	}
	if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
		return false;
	}
	return true;
}

export const SitePagesNav = memo(function SitePagesNav({
	sitePages,
	currentPath,
}: SitePagesNavProps) {
	const router = useRouter();

	return (
		<nav className={pagesNavClass} aria-label="Pages">
			{sitePages.map((p) => {
				const active = p.path === currentPath;
				return (
					<a
						key={p.path}
						href={p.path}
						className={cx(
							pageLinkBaseClass,
							active ? pageLinkActiveClass : pageLinkInactiveClass,
						)}
						onMouseEnter={() => {
							router.prefetch(p.path);
						}}
						onClick={(e) => {
							if (!isPlainLeftClick(e)) {
								return;
							}
							e.preventDefault();
							router.push(p.path);
						}}>
						<span>{p.title}</span>
						{active && (
							<span className={pageLinkAdornmentClass}>
								<span className={pageLinkDotClass} aria-hidden />
							</span>
						)}
					</a>
				);
			})}
			<a
				href={githubUrl}
				target="_blank"
				rel="noreferrer"
				className={cx(
					pageLinkBaseClass,
					pageLinkInactiveClass,
					"site-nav-github-link",
				)}>
				<span>GitHub</span>
				<span className={pageLinkAdornmentClass}>
					<span
						{...{ [PAGE_LINK_ARROW_ATTR]: PAGE_LINK_ARROW_VALUE }}
						aria-hidden>
						↗
					</span>
				</span>
			</a>
		</nav>
	);
});
