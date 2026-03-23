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

const tocSectionBlockClass = css({
	display: "flex",
	flexDirection: "column",
	gap: "1",
});

/** Grid row animation: 0fr → 1fr interpolates to natural height without fixed max-height. */
const tocNestedRevealClass = css({
	display: "grid",
	gridTemplateRows: "0fr",
	transitionProperty: "grid-template-rows",
	transitionDuration: "320ms",
	transitionTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
	"@media (prefers-reduced-motion: reduce)": {
		transitionDuration: "0.01ms",
	},
});

const tocNestedRevealExpandedClass = css({
	gridTemplateRows: "1fr",
});

const tocNestedRevealInnerClass = css({
	minHeight: "0",
	overflow: "hidden",
});

const tocNestedListClass = css({
	display: "flex",
	flexDirection: "column",
	gap: "0.5",
	borderLeftWidth: "2px",
	borderLeftStyle: "solid",
	borderLeftColor: "border",
	marginLeft: "1",
	paddingLeft: "3",
	marginTop: "0.5",
});

const tocNestedLinkH4IndentClass = css({
	pl: "2",
});

function groupTocIntoSections(toc: TocEntry[]): Array<{
	root: TocEntry;
	children: TocEntry[];
}> {
	const sections: Array<{ root: TocEntry; children: TocEntry[] }> = [];
	let current: { root: TocEntry; children: TocEntry[] } | null = null;

	for (const entry of toc) {
		if (entry.depth === 2) {
			current = { root: entry, children: [] };
			sections.push(current);
		} else if (entry.depth > 2 && current) {
			current.children.push(entry);
		}
	}

	if (sections.length === 0 && toc.length > 0) {
		return toc.map((entry): { root: TocEntry; children: TocEntry[] } => ({
			root: entry,
			children: [],
		}));
	}

	return sections;
}

function sectionContainsActiveId(
	section: { root: TocEntry; children: TocEntry[] },
	activeId: string | null,
): boolean {
	if (activeId === null) {
		return false;
	}
	if (section.root.id === activeId) {
		return true;
	}
	return section.children.some((c) => c.id === activeId);
}

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

	const sections = groupTocIntoSections(toc);

	const scrollToTocTarget = (id: string) => {
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView({
				behavior: "auto",
				block: "start",
			});
		}
		window.history.replaceState(null, "", `#${id}`);
		setActiveId(id);
	};

	return (
		<div className={cx(tocRootClass, className)}>
			<span className={tocHeadingLabelClass}>On page</span>
			<nav className={tocLinksCardClass} aria-label="Table of contents">
				{sections.map((section) => {
					const showNested =
						section.children.length > 0 &&
						sectionContainsActiveId(section, activeId);
					const rootActive = section.root.id === activeId;

					return (
						<div key={section.root.id} className={tocSectionBlockClass}>
							<a
								href={`#${section.root.id}`}
								className={cx(
									tocLinkBaseClass,
									rootActive ? tocLinkActiveClass : tocLinkInactiveClass,
								)}
								aria-current={rootActive ? "location" : undefined}
								onClick={(e) => {
									e.preventDefault();
									scrollToTocTarget(section.root.id);
								}}>
								{section.root.label}
							</a>
							{section.children.length > 0 && (
								<div
									className={cx(
										tocNestedRevealClass,
										showNested && tocNestedRevealExpandedClass,
									)}
									inert={showNested ? undefined : true}>
									<div className={tocNestedRevealInnerClass}>
										<div className={tocNestedListClass}>
											{section.children.map((child) => {
												const childActive = child.id === activeId;
												return (
													<a
														key={child.id}
														href={`#${child.id}`}
														className={cx(
															tocLinkBaseClass,
															childActive
																? tocLinkActiveClass
																: tocLinkInactiveClass,
															child.depth >= 4 && tocNestedLinkH4IndentClass,
														)}
														aria-current={childActive ? "location" : undefined}
														onClick={(e) => {
															e.preventDefault();
															scrollToTocTarget(child.id);
														}}>
														{child.label}
													</a>
												);
											})}
										</div>
									</div>
								</div>
							)}
						</div>
					);
				})}
			</nav>
		</div>
	);
};
