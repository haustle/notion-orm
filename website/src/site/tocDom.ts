import type { TocNavigationState, TocSection } from "./toc";
import { sectionShouldBeExpanded } from "./toc";

export interface TocDomClassNames {
	linkActive: string;
	linkInactive: string;
	nestedExpanded: string;
	nestedCollapsed: string;
}

export interface TocDomRegistry {
	byId: Map<string, { el: HTMLAnchorElement; kind: "root" | "child" }>;
	nestedBySectionId: Map<string, HTMLElement>;
}

/** Panda `css()` can return multiple space-separated atomic classes in one string; `classList` needs one token per call. */
function classGroupTokens(classGroup: string): string[] {
	return classGroup.split(/\s+/).filter(Boolean);
}

function removeClassGroups(el: HTMLElement, ...classGroups: string[]): void {
	for (const group of classGroups) {
		for (const token of classGroupTokens(group)) {
			el.classList.remove(token);
		}
	}
}

function addClassGroup(el: HTMLElement, classGroup: string): void {
	for (const token of classGroupTokens(classGroup)) {
		el.classList.add(token);
	}
}

export function buildTocDomRegistry(nav: HTMLElement): TocDomRegistry {
	const byId = new Map<
		string,
		{ el: HTMLAnchorElement; kind: "root" | "child" }
	>();

	for (const a of nav.querySelectorAll<HTMLAnchorElement>("[data-toc-link]")) {
		const id = a.getAttribute("data-toc-id");
		const kind = a.getAttribute("data-toc-kind");
		if (
			id &&
			(kind === "root" || kind === "child")
		) {
			byId.set(id, { el: a, kind });
		}
	}

	const nestedBySectionId = new Map<string, HTMLElement>();
	for (const el of nav.querySelectorAll<HTMLElement>("[data-toc-nested]")) {
		const sectionId = el.getAttribute("data-toc-nested");
		if (sectionId) {
			nestedBySectionId.set(sectionId, el);
		}
	}

	return { byId, nestedBySectionId };
}

/**
 * Idempotent: toggles classList + aria; caller should skip when state is unchanged
 * (see updateTocNavigationState in toc.ts).
 */
export function applyTocVisuals(args: {
	state: TocNavigationState;
	sections: TocSection[];
	registry: TocDomRegistry;
	classNames: TocDomClassNames;
}): void {
	const { state, sections, registry, classNames: cn } = args;
	const { activeId, revealedRootId } = state;
	const { byId, nestedBySectionId } = registry;

	for (const [id, { el }] of byId) {
		const isActive = id === activeId;
		removeClassGroups(el, cn.linkActive, cn.linkInactive);
		addClassGroup(el, isActive ? cn.linkActive : cn.linkInactive);
		if (isActive) {
			el.setAttribute("aria-current", "location");
		} else {
			el.removeAttribute("aria-current");
		}
	}

	for (const section of sections) {
		if (section.children.length === 0) {
			continue;
		}
		const wrapper = nestedBySectionId.get(section.root.id);
		if (!wrapper) {
			continue;
		}

		const showNested = sectionShouldBeExpanded({
			section,
			activeId,
			revealedRootId,
		});

		removeClassGroups(wrapper, cn.nestedExpanded, cn.nestedCollapsed);
		addClassGroup(
			wrapper,
			showNested ? cn.nestedExpanded : cn.nestedCollapsed,
		);
		wrapper.setAttribute("aria-hidden", showNested ? "false" : "true");

		for (const child of section.children) {
			const entry = byId.get(child.id);
			if (entry?.kind === "child") {
				if (showNested) {
					entry.el.removeAttribute("tabIndex");
				} else {
					entry.el.tabIndex = -1;
				}
			}
		}
	}
}

export function statesEqual(a: TocNavigationState, b: TocNavigationState): boolean {
	return a.activeId === b.activeId && a.revealedRootId === b.revealedRootId;
}
