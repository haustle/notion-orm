"use client";

import { type FC, useEffect, useState } from "react";
import { css, cx } from "../styled-system/css";
import type { TocEntry } from "./types";

interface PageTocProps {
	toc: TocEntry[];
	className?: string;
}

const tocHeadingLabelClass = css({
	fontSize: "sm",
	fontWeight: "600",
	color: "text",
	letterSpacing: "wider",
	mb: "2.5",
	px: "3",
});

const tocRootClass = css({
	width: "225px",
});

const tocLinksCardClass = css({
	display: "flex",
	flexDirection: "column",
	gap: "1",
	bg: "codeBg",
	rounded: "10",
	minW: "6",
	px: "3",
	py: "2",
});

const tocLinkBaseClass = css({
	display: "block",
	py: "1",
	fontSize: "sm",
	lineHeight: "1.5",
	transitionProperty: "color, font-weight",
	transitionDuration: "220ms",
	_hover: {
		color: { base: "text", _dark: "white" },
		fontWeight: "600",
	},
});

const tocLinkActiveClass = css({
	fontWeight: "600",
	color: { base: "text", _dark: "white" },
});

const tocLinkInactiveClass = css({
	fontWeight: "400",
	color: "muted",
});

const HEADING_ACTIVATION_OFFSET = 140;
const BOTTOM_OF_PAGE_THRESHOLD = 8;

function getActiveHeadingId(toc: TocEntry[]): string | null {
	const headings = toc
		.map((entry) => document.getElementById(entry.id))
		.filter(
			(heading): heading is HTMLElement => heading instanceof HTMLElement,
		);

	if (headings.length === 0) {
		return null;
	}

	const scrollBottom = window.scrollY + window.innerHeight;
	const documentHeight = document.documentElement.scrollHeight;

	if (scrollBottom >= documentHeight - BOTTOM_OF_PAGE_THRESHOLD) {
		return headings.at(-1)?.id ?? null;
	}

	let activeId = headings[0].id;

	for (const heading of headings) {
		if (heading.getBoundingClientRect().top <= HEADING_ACTIVATION_OFFSET) {
			activeId = heading.id;
			continue;
		}

		break;
	}

	return activeId;
}

export const PageToc: FC<PageTocProps> = ({ toc, className }) => {
	const [activeId, setActiveId] = useState<string | null>(toc[0]?.id ?? null);

	useEffect(() => {
		if (toc.length === 0) {
			return;
		}

		const updateActiveHeading = () => {
			const nextActiveId = getActiveHeadingId(toc);

			if (nextActiveId) {
				setActiveId((currentActiveId) =>
					currentActiveId === nextActiveId ? currentActiveId : nextActiveId,
				);
			}
		};

		const scrollToHashIfInToc = (id: string): boolean => {
			if (!id || !toc.some((e) => e.id === id)) {
				return false;
			}

			document.getElementById(id)?.scrollIntoView({
				behavior: "auto",
				block: "start",
			});
			setActiveId(id);
			return true;
		};

		const hashId = window.location.hash.slice(1);
		const hashMatchesToc = Boolean(hashId && toc.some((e) => e.id === hashId));

		if (hashMatchesToc) {
			window.requestAnimationFrame(() => {
				scrollToHashIfInToc(hashId);
			});
		} else {
			updateActiveHeading();
		}

		let rafId: number | null = null;
		const scheduleUpdate = () => {
			if (rafId !== null) {
				return;
			}

			rafId = window.requestAnimationFrame(() => {
				rafId = null;
				updateActiveHeading();
			});
		};

		const onHashChange = () => {
			if (!scrollToHashIfInToc(window.location.hash.slice(1))) {
				scheduleUpdate();
			}
		};

		window.addEventListener("scroll", scheduleUpdate, { passive: true });
		window.addEventListener("resize", scheduleUpdate, { passive: true });
		window.addEventListener("hashchange", onHashChange);

		return () => {
			window.removeEventListener("scroll", scheduleUpdate);
			window.removeEventListener("resize", scheduleUpdate);
			window.removeEventListener("hashchange", onHashChange);

			if (rafId !== null) {
				window.cancelAnimationFrame(rafId);
			}
		};
	}, [toc]);

	if (toc.length === 0) {
		return null;
	}

	return (
		<div className={cx(tocRootClass, className)}>
			<span className={tocHeadingLabelClass}>On page</span>
			<nav className={tocLinksCardClass} aria-label="Table of contents">
				{toc.map((entry) => {
					const active = entry.id === activeId;
					return (
						<a
							key={entry.id}
							href={`#${entry.id}`}
							className={cx(
								tocLinkBaseClass,
								active ? tocLinkActiveClass : tocLinkInactiveClass,
							)}
							aria-current={active ? "location" : undefined}
							onClick={(e) => {
								e.preventDefault();
								const el = document.getElementById(entry.id);
								if (el) {
									el.scrollIntoView({
										behavior: "auto",
										block: "start",
									});
								}
								window.history.replaceState(null, "", `#${entry.id}`);
								setActiveId(entry.id);
							}}>
							{entry.label}
						</a>
					);
				})}
			</nav>
		</div>
	);
};

export { PageToc as TocNav };
