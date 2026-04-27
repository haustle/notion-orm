"use client";

import {
	type FC,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react";
import { css, cx } from "../styled-system/css";
import {
	BOTTOM_OF_PAGE_THRESHOLD,
	getActiveHeadingIdFromTargets,
	getMissingTocTargetIds,
	getTocNavigationState,
	getTocTargetOrderMismatch,
	groupTocIntoSections,
	HEADING_ACTIVATION_OFFSET,
	type TocNavigationState,
	type TocSection,
	updateTocNavigationState,
} from "./toc";
import {
	applyTocVisuals,
	buildTocDomRegistry,
	statesEqual,
	type TocDomClassNames,
} from "./tocDom";
import { playTocHeadingClickFlash } from "./tocHeadingClickFlash";
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
	flexShrink: "0",
});

const tocRootClass = css({
	width: "225px",
	display: "flex",
	flexDirection: "column",
	flex: "1 1 0%",
	minH: "0",
	maxH: "100%",
	overflow: "hidden",
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
	flex: "1 1 0%",
	minH: "0",
	maxH: "100%",
	overflowY: "auto",
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

const tocDomClassNames: TocDomClassNames = {
	linkActive: tocLinkActiveClass,
	linkInactive: tocLinkInactiveClass,
	nestedExpanded: tocNestedRevealExpandedClass,
	nestedCollapsed: tocNestedRevealCollapsedClass,
};

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

function buildHeadingIdToElement(
	headings: HTMLElement[],
): Map<string, HTMLElement> {
	return new Map(headings.map((h) => [h.id, h]));
}

/**
 * In-page only: all targets already resolved to elements (same document as the TOC).
 * Hot path: called once per rAF on scroll; cached headings avoid N× getElementById.
 */
function getActiveHeadingIdFromHeadings(
	headings: HTMLElement[],
): string | null {
	if (headings.length === 0) {
		return null;
	}

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
	const navRef = useRef<HTMLElement | null>(null);
	/** In-page section headings (same document); rebuilt when `toc` changes. Avoids N× getElementById on every scroll rAF. */
	const headingsInDomRef = useRef<HTMLElement[]>([]);
	const headingIdToElementRef = useRef<Map<string, HTMLElement>>(new Map());
	const registryRef = useRef<ReturnType<typeof buildTocDomRegistry> | null>(
		null,
	);
	const tocNavStateRef = useRef<TocNavigationState>(
		getTocNavigationState({
			sections,
			entryId: toc[0]?.id ?? null,
		}),
	);
	/** Latest grouped `sections` and `toc` — one ref, one assign per render, for stable callbacks. */
	const tocModelRef = useRef<{
		sections: TocSection[];
		toc: TocEntry[];
	}>({ sections, toc });
	tocModelRef.current = { sections, toc };

	const commitNavigationState = useCallback((next: TocNavigationState) => {
		if (statesEqual(next, tocNavStateRef.current)) {
			return;
		}
		tocNavStateRef.current = next;
		const registry = registryRef.current;
		if (!registry) {
			return;
		}
		applyTocVisuals({
			state: next,
			sections: tocModelRef.current.sections,
			registry,
			classNames: tocDomClassNames,
		});
	}, []);

	const applyTocEntryId = useCallback((entryId: string | null) => {
		const next = updateTocNavigationState({
			sections: tocModelRef.current.sections,
			currentState: tocNavStateRef.current,
			entryId,
		});
		commitNavigationState(next);
	}, [commitNavigationState]);

	/**
	 * Same document / same route only: `id` is always a section on this page. We resolve the
	 * target from `headingIdToElementRef` when possible (O(1)) instead of `getElementById` on
	 * every click, and the hash is only changed via `replaceState` (in-page; no client route transition).
	 */
	const navigateToTocEntry = useCallback(
		(
			id: string,
			options: {
				scroll: boolean;
				updateHash: boolean;
				playHeadingClickFlash?: boolean;
			},
		): boolean => {
			const { toc: tocCurrent } = tocModelRef.current;
			if (!id || !tocCurrent.some((entry) => entry.id === id)) {
				return false;
			}

			if (options.scroll) {
				const target =
					headingIdToElementRef.current.get(id) ??
					document.getElementById(id);
				target?.scrollIntoView({
					behavior: "auto",
					block: "start",
				});
			}
			if (options.updateHash) {
				// Defer hash write so the App Router’s outer layout is less likely to sync in the
				// same turn as scroll + imperative TOC DOM (same URL path; hash-only).
				queueMicrotask(() => {
					window.history.replaceState(null, "", `#${id}`);
				});
			}
			applyTocEntryId(id);
			if (options.playHeadingClickFlash) {
				window.requestAnimationFrame(() => {
					window.requestAnimationFrame(() => {
						playTocHeadingClickFlash(id);
					});
				});
			}
			return true;
		},
		[applyTocEntryId],
	);

	useLayoutEffect(() => {
		if (toc.length === 0 || !navRef.current) {
			return;
		}

		const headingList = getHeadingElementsInDomOrder(toc);
		headingsInDomRef.current = headingList;
		headingIdToElementRef.current = buildHeadingIdToElement(headingList);

		const builtRegistry = buildTocDomRegistry(navRef.current);
		registryRef.current = builtRegistry;

		const { sections: groupedSections, toc: tocForLayout } = tocModelRef.current;
		const hashId = window.location.hash.slice(1);
		const hashMatchesToc = Boolean(
			hashId && tocForLayout.some((e) => e.id === hashId),
		);

		const initial = hashMatchesToc
			? getTocNavigationState({
					sections: groupedSections,
					entryId: hashId,
				})
			: getTocNavigationState({
					sections: groupedSections,
					entryId: getActiveHeadingIdFromHeadings(headingList),
				});

		tocNavStateRef.current = initial;
		applyTocVisuals({
			state: initial,
			sections: groupedSections,
			registry: builtRegistry,
			classNames: tocDomClassNames,
		});
	}, [toc, sections]);

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
			let list = headingsInDomRef.current;
			if (list.length === 0) {
				list = getHeadingElementsInDomOrder(toc);
				headingsInDomRef.current = list;
				headingIdToElementRef.current = buildHeadingIdToElement(list);
			}
			applyTocEntryId(getActiveHeadingIdFromHeadings(list));
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
			<nav
				ref={navRef}
				className={tocLinksCardClass}
				aria-label="Table of contents">
				{sections.map((section) => {
					return (
						<div key={section.root.id} className={tocSectionBlockClass}>
							<a
								href={`#${section.root.id}`}
								title={section.root.label}
								data-toc-link
								data-toc-id={section.root.id}
								data-toc-kind="root"
								className={cx(tocLinkBaseClass, tocLinkInactiveClass)}
								onClick={(e) => {
									e.preventDefault();
									navigateToTocEntry(section.root.id, {
										scroll: true,
										updateHash: true,
										playHeadingClickFlash: true,
									});
								}}>
								{section.root.label}
							</a>
							{section.children.length > 0 && (
								<div
									data-toc-nested={section.root.id}
									className={tocNestedRevealCollapsedClass}
									aria-hidden>
									<div className={tocNestedRevealInnerClass}>
										<div className={tocNestedListClass}>
											<div className={tocNestedAccentBarClass} aria-hidden />
											<div className={tocNestedLinksColumnClass}>
												{section.children.map((child) => {
													return (
														<a
															key={child.id}
															href={`#${child.id}`}
															title={child.label}
															data-toc-link
															data-toc-id={child.id}
															data-toc-kind="child"
															className={cx(
																tocLinkBaseClass,
																tocLinkInactiveClass,
																child.depth >= 4 &&
																	tocNestedLinkH4IndentClass,
															)}
															tabIndex={-1}
															onClick={(e) => {
																e.preventDefault();
																navigateToTocEntry(child.id, {
																	scroll: true,
																	updateHash: true,
																	playHeadingClickFlash: true,
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
