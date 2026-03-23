/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import {
	getActiveHeadingIdFromTargets,
	getMissingTocTargetIds,
	getSectionRootIdForEntryId,
	getTocNavigationState,
	getTocTargetOrderMismatch,
	groupTocIntoSections,
	sectionContainsActiveId,
	sectionShouldBeExpanded,
	type TocHeadingTarget,
	type TocNavigationState,
	updateTocNavigationState,
} from "../src/site/toc";
import type { TocEntry } from "../src/site/types";
import { sampleTocNested } from "./fixtures/toc";

describe("groupTocIntoSections", () => {
	test("nests subheadings under the preceding h2 section", () => {
		expect(groupTocIntoSections(sampleTocNested)).toEqual([
			{
				root: { id: "intro", label: "Intro", depth: 2 },
				children: [
					{ id: "overview", label: "Overview", depth: 3 },
					{ id: "details", label: "Details", depth: 4 },
				],
			},
			{
				root: { id: "api", label: "API", depth: 2 },
				children: [],
			},
		]);
	});

	test("falls back to flat sections when no h2 headings exist", () => {
		const flat: TocEntry[] = [
			{ id: "child-a", label: "Child A", depth: 3 },
			{ id: "child-b", label: "Child B", depth: 4 },
		];
		expect(groupTocIntoSections(flat)).toEqual([
			{
				root: { id: "child-a", label: "Child A", depth: 3 },
				children: [],
			},
			{
				root: { id: "child-b", label: "Child B", depth: 4 },
				children: [],
			},
		]);
	});
});

describe("sectionContainsActiveId", () => {
	test("expands a section when either the root or a child is active", () => {
		const [section] = groupTocIntoSections(sampleTocNested);
		expect(section).toBeDefined();
		if (section === undefined) {
			throw new Error("expected a grouped TOC section");
		}

		expect(sectionContainsActiveId(section, "intro")).toBe(true);
		expect(sectionContainsActiveId(section, "overview")).toBe(true);
		expect(sectionContainsActiveId(section, "api")).toBe(false);
	});
});

describe("getSectionRootIdForEntryId", () => {
	test("maps both roots and nested entries back to the section root", () => {
		const sections = groupTocIntoSections(sampleTocNested);
		expect(getSectionRootIdForEntryId(sections, "intro")).toBe("intro");
		expect(getSectionRootIdForEntryId(sections, "details")).toBe("intro");
		expect(getSectionRootIdForEntryId(sections, "missing")).toBeNull();
		expect(getSectionRootIdForEntryId(sections, null)).toBeNull();
	});
});

describe("sectionShouldBeExpanded", () => {
	test("keeps nested links open for the active section", () => {
		const [section] = groupTocIntoSections(sampleTocNested);
		expect(section).toBeDefined();
		if (section === undefined) {
			throw new Error("expected a grouped TOC section");
		}

		expect(
			sectionShouldBeExpanded({
				section,
				activeId: "overview",
				revealedRootId: null,
			}),
		).toBe(true);
	});

	test("keeps a manually revealed section open even before scroll state catches up", () => {
		const [section] = groupTocIntoSections(sampleTocNested);
		expect(section).toBeDefined();
		if (section === undefined) {
			throw new Error("expected a grouped TOC section");
		}

		expect(
			sectionShouldBeExpanded({
				section,
				activeId: "api",
				revealedRootId: "intro",
			}),
		).toBe(true);
	});

	test("does not expand sections without nested headings", () => {
		const [, secondSection] = groupTocIntoSections(sampleTocNested);
		expect(secondSection).toBeDefined();
		if (secondSection === undefined) {
			throw new Error("expected a second grouped TOC section");
		}

		expect(
			sectionShouldBeExpanded({
				section: secondSection,
				activeId: "api",
				revealedRootId: "api",
			}),
		).toBe(false);
	});
});

describe("getTocNavigationState", () => {
	test("derives both the active heading and revealed root from a child entry", () => {
		const sections = groupTocIntoSections(sampleTocNested);
		expect(
			getTocNavigationState({
				sections,
				entryId: "details",
			}),
		).toEqual({
			activeId: "details",
			revealedRootId: "intro",
		} satisfies TocNavigationState);
	});
});

describe("updateTocNavigationState", () => {
	test("keeps a manual reveal until the active section changes", () => {
		const sections = groupTocIntoSections(sampleTocNested);
		expect(
			updateTocNavigationState({
				sections,
				currentState: {
					activeId: "intro",
					revealedRootId: "intro",
				},
				entryId: "overview",
			}),
		).toEqual({
			activeId: "overview",
			revealedRootId: "intro",
		} satisfies TocNavigationState);
	});

	test("closes the old reveal when navigation advances to another section", () => {
		const sections = groupTocIntoSections(sampleTocNested);
		expect(
			updateTocNavigationState({
				sections,
				currentState: {
					activeId: "overview",
					revealedRootId: "intro",
				},
				entryId: "api",
			}),
		).toEqual({
			activeId: "api",
			revealedRootId: "api",
		} satisfies TocNavigationState);
	});

	test("ignores null targets and preserves the current state", () => {
		const sections = groupTocIntoSections(sampleTocNested);
		const currentState = {
			activeId: "overview",
			revealedRootId: "intro",
		} satisfies TocNavigationState;
		expect(
			updateTocNavigationState({
				sections,
				currentState,
				entryId: null,
			}),
		).toBe(currentState);
	});
});

describe("getTocTargetOrderMismatch", () => {
	test("reports when DOM heading order no longer matches TOC order", () => {
		expect(
			getTocTargetOrderMismatch({
				toc: sampleTocNested,
				targetIdsInDomOrder: ["overview", "intro", "details", "api"],
			}),
		).toEqual({
			expectedIds: ["intro", "overview", "details", "api"],
			actualIds: ["overview", "intro", "details", "api"],
		});
	});

	test("returns null when TOC order matches the DOM order", () => {
		expect(
			getTocTargetOrderMismatch({
				toc: sampleTocNested,
				targetIdsInDomOrder: ["intro", "overview", "details", "api"],
			}),
		).toBeNull();
	});
});

describe("getActiveHeadingIdFromTargets", () => {
	test("chooses the last heading above the activation threshold", () => {
		const headings = [
			{ id: "intro", top: -20 },
			{ id: "overview", top: 60 },
			{ id: "details", top: 220 },
		] satisfies TocHeadingTarget[];
		expect(
			getActiveHeadingIdFromTargets({
				headings,
				isAtBottom: false,
				activationOffset: 140,
			}),
		).toBe("overview");
	});

	test("pins to the final heading at the bottom of the page", () => {
		const headings = [
			{ id: "intro", top: -20 },
			{ id: "overview", top: 120 },
			{ id: "details", top: 380 },
		] satisfies TocHeadingTarget[];
		expect(
			getActiveHeadingIdFromTargets({
				headings,
				isAtBottom: true,
			}),
		).toBe("details");
	});
});

describe("getMissingTocTargetIds", () => {
	test("reports TOC entries that do not resolve to DOM headings", () => {
		expect(
			getMissingTocTargetIds({
				toc: sampleTocNested,
				getElementById: (id) =>
					id === "intro" || id === "overview" ? {} : null,
			}),
		).toEqual(["details", "api"]);
	});
});
