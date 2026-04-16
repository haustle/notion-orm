"use client";

import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { css, cx } from "../styled-system/css";
import {
	BOTTOM_OF_PAGE_THRESHOLD,
	getActiveHeadingIdFromTargets,
	getMissingTocTargetIds,
	getTocNavigationState,
	getTocTargetOrderMismatch,
	groupTocIntoSections,
	HEADING_ACTIVATION_OFFSET,
	sectionShouldBeExpanded,
	updateTocNavigationState,
} from "./toc";
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
	minW: "0",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
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

/** Mutually exclusive with `tocNestedRevealExpandedClass` — do not merge (opacity would fight). */
const tocNestedRevealCollapsedClass = css({
	display: "grid",
	gridTemplateRows: "0fr",
	opacity: 0,
	pointerEvents: "none",
	alignSelf: "flex-start",
	width: "100%",
	transitionProperty: "grid-template-rows, opacity",
	transitionDuration: "320ms",
	transitionTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
	"@media (prefers-reduced-motion: reduce)": {
		transitionDuration: "0.01ms",
	},
});

const tocNestedRevealExpandedClass = css({
	display: "grid",
	gridTemplateRows: "1fr",
	opacity: 1,
	pointerEvents: "auto",
	alignSelf: "flex-start",
	width: "100%",
	transitionProperty: "grid-template-rows, opacity",
	transitionDuration: "320ms",
	transitionTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
	"@media (prefers-reduced-motion: reduce)": {
		transitionDuration: "0.01ms",
	},
});

const tocNestedRevealInnerClass = css({
	minHeight: "0",
	overflow: "hidden",
});

const tocNestedListClass = css({
	display: "flex",
	flexDirection: "row",
	alignItems: "stretch",
	gap: "3",
	marginLeft: "1",
	marginTop: "0.5",
	minW: "0",
});

const tocNestedAccentBarClass = css({
	flexShrink: 0,
	w: "4px",
	alignSelf: "stretch",
	bg: "border",
	borderRadius: "2px",
});

const tocNestedLinksColumnClass = css({
	display: "flex",
	flexDirection: "column",
	gap: "0.5",
	flex: "1",
	minW: "0",
});

const tocNestedLinkH4IndentClass = css({
	pl: "2",
});

function compareElementsInDocumentOrder(
	left: HTMLElement,
	right: HTMLElement,
): number {
	if (left === right) {
		return 0;
	}

	const position = left.compareDocumentPosition(right);
	if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
		return -1;
	}
	if (position & Node.DOCUMENT_POSITION_PRECEDING) {
		return 1;
	}
	return 0;
}

function getHeadingElementsInDomOrder(toc: TocEntry[]): HTMLElement[] {
	return toc
		.map((entry) => document.getElementById(entry.id))
		.filter((heading): heading is HTMLElement => heading instanceof HTMLElement)
		.sort(compareElementsInDocumentOrder);
}

function getActiveHeadingId(toc: TocEntry[]): string | null {
	const headings = getHeadingElementsInDomOrder(toc);

	const scrollBottom = window.scrollY + window.innerHeight;
	const documentHeight = document.documentElement.scrollHeight;

	return getActiveHeadingIdFromTargets({
		headings: headings.map((heading) => ({
			id: heading.id,
			top: heading.getBoundingClientRect().top,
		})),
		isAtBottom: scrollBottom >= documentHeight - BOTTOM_OF_PAGE_THRESHOLD,
		activationOffset: HEADING_ACTIVATION_OFFSET,
	});
}

export const PageToc: FC<PageTocProps> = ({ toc, className }) => {
	const sections = useMemo(() => groupTocIntoSections(toc), [toc]);
	const [navigationState, setNavigationState] = useState(() =>
		getTocNavigationState({
			sections,
			entryId: toc[0]?.id ?? null,
		}),
	);
	const { activeId, revealedRootId } = navigationState;

	useEffect(() => {
		setNavigationState(
			getTocNavigationState({
				sections,
				entryId: toc[0]?.id ?? null,
			}),
		);
	}, [sections, toc]);

	const applyTocEntryId = useCallback(
		(entryId: string | null) => {
			setNavigationState((currentState) =>
				updateTocNavigationState({
					sections,
					currentState,
					entryId,
				}),
			);
		},
		[sections],
	);

	const navigateToTocEntry = useCallback(
		(
			id: string,
			options: {
				scroll: boolean;
				updateHash: boolean;
			},
		): boolean => {
			if (!id || !toc.some((entry) => entry.id === id)) {
				return false;
			}

			if (options.scroll) {
				document.getElementById(id)?.scrollIntoView({
					behavior: "auto",
					block: "start",
				});
			}
			if (options.updateHash) {
				window.history.replaceState(null, "", `#${id}`);
			}
			applyTocEntryId(id);
			return true;
		},
		[applyTocEntryId, toc],
	);

	useEffect(() => {
		if (toc.length === 0) {
			return;
		}

		if (process.env.NODE_ENV !== "production") {
			const missingIds = getMissingTocTargetIds({
				toc,
				getElementById: (id) => document.getElementById(id),
			});
			if (missingIds.length > 0) {
				throw new Error(
					`[toc] Missing heading targets for ids: ${missingIds.join(", ")}`,
				);
			}

			const orderMismatch = getTocTargetOrderMismatch({
				toc,
				targetIdsInDomOrder: getHeadingElementsInDomOrder(toc).map(
					(heading) => heading.id,
				),
			});
			if (orderMismatch) {
				throw new Error(
					`[toc] Heading order mismatch. expected: ${orderMismatch.expectedIds.join(", ")}; actual: ${orderMismatch.actualIds.join(", ")}`,
				);
			}
		}

		const updateActiveHeading = () => {
			applyTocEntryId(getActiveHeadingId(toc));
		};

		const hashId = window.location.hash.slice(1);
		const hashMatchesToc = Boolean(hashId && toc.some((e) => e.id === hashId));

		if (hashMatchesToc) {
			window.requestAnimationFrame(() => {
				navigateToTocEntry(hashId, {
					scroll: true,
					updateHash: false,
				});
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
			if (
				!navigateToTocEntry(window.location.hash.slice(1), {
					scroll: true,
					updateHash: false,
				})
			) {
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
	}, [applyTocEntryId, navigateToTocEntry, toc]);

	if (toc.length === 0) {
		return null;
	}

	return (
		<div className={cx(tocRootClass, className)}>
			<span className={tocHeadingLabelClass}>On page</span>
			<nav className={tocLinksCardClass} aria-label="Table of contents">
				{sections.map((section) => {
					const showNested = sectionShouldBeExpanded({
						section,
						activeId,
						revealedRootId,
					});
					const rootActive = section.root.id === activeId;

					return (
						<div key={section.root.id} className={tocSectionBlockClass}>
							<a
								href={`#${section.root.id}`}
								title={section.root.label}
								className={cx(
									tocLinkBaseClass,
									rootActive ? tocLinkActiveClass : tocLinkInactiveClass,
								)}
								aria-current={rootActive ? "location" : undefined}
								onClick={(e) => {
									e.preventDefault();
									navigateToTocEntry(section.root.id, {
										scroll: true,
										updateHash: true,
									});
								}}>
								{section.root.label}
							</a>
							{section.children.length > 0 && (
								<div
									className={
										showNested
											? tocNestedRevealExpandedClass
											: tocNestedRevealCollapsedClass
									}
									aria-hidden={!showNested}>
									<div className={tocNestedRevealInnerClass}>
										<div className={tocNestedListClass}>
											<div className={tocNestedAccentBarClass} aria-hidden />
											<div className={tocNestedLinksColumnClass}>
												{section.children.map((child) => {
													const childActive = child.id === activeId;
													return (
														<a
															key={child.id}
															href={`#${child.id}`}
															title={child.label}
															className={cx(
																tocLinkBaseClass,
																childActive
																	? tocLinkActiveClass
																	: tocLinkInactiveClass,
																child.depth >= 4 &&
																	tocNestedLinkH4IndentClass,
															)}
															aria-current={
																childActive ? "location" : undefined
															}
															tabIndex={showNested ? undefined : -1}
															onClick={(e) => {
																e.preventDefault();
																navigateToTocEntry(child.id, {
																	scroll: true,
																	updateHash: true,
																});
															}}>
															{child.label}
														</a>
													);
												})}
											</div>
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
