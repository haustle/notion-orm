"use client";

import {
	autocompletion,
	closeBrackets,
	closeBracketsKeymap,
	completionKeymap,
} from "@codemirror/autocomplete";
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import {
	bracketMatching,
	ensureSyntaxTree,
	foldAll,
	foldGutter,
	foldKeymap,
	indentOnInput,
} from "@codemirror/language";
import { linter, lintGutter, lintKeymap } from "@codemirror/lint";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
	drawSelection,
	dropCursor,
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	highlightSpecialChars,
	keymap,
	lineNumbers,
	ViewPlugin,
} from "@codemirror/view";
import type { VirtualTypeScriptEnvironment } from "@typescript/vfs";
import { getLints, tsFacet, tsHover, tsSync } from "@valtown/codemirror-ts";
import Link from "next/link";
import type { MutableRefObject, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { clouds } from "thememirror";
import { cx } from "../../styled-system/css";
import {
	cmDemoSiteClassNames as cm,
	cmDemoTooltipQuerySelectorList,
	DEMO_PLAYGROUND_RESET_BUTTON_CLASS,
	SITE_COLOR_MODE_ATTR,
	SITE_COLOR_MODE_DARK,
	siteMonoFontFamilyCssVar,
} from "../siteClassNames";
import { cmOneDarkTheme } from "./cmOneDarkTheme";
import {
	playgroundApiReferenceLinkClass as apiReferenceLinkClass,
	demoPlaygroundPanelMeta,
	playgroundEditorContainerClass as editorContainerClass,
	playgroundEditorContainerPlaceholderClass as editorContainerPlaceholderClass,
	playgroundFileLabelClass as fileLabelClass,
	playgroundHeaderActionsClass as headerActionsClass,
	playgroundHeaderBulletClass as headerBulletClass,
	playgroundHeaderClass as headerClass,
	playgroundHeaderTitleGroupClass as headerTitleGroupClass,
	playgroundLoadingOverlayClass as loadingOverlayClass,
	playgroundResetButtonClass as resetButtonClass,
	playgroundSectionGapClass as sectionGapClass,
	playgroundWrapperClass as wrapperClass,
} from "./demoPlaygroundChrome";
import { ideLikeTsAutocomplete } from "./ideLikeTsAutocomplete";
import {
	agentEntryFile,
	databaseEntryFile,
	playgroundFiles,
} from "./playgroundFiles";

type TypeScriptApi = typeof import("typescript");

const TS_LINTER_DIAGNOSTIC_CODES_IGNORE = [1375, 1378, 2792, 2821] as const;
const demoSyntaxThemeCompartment = new Compartment();
const demoEditorChromeCompartment = new Compartment();

function typeScriptLinterExtension() {
	return linter(
		async (view) => {
			const config = view.state.facet(tsFacet);
			return config
				? getLints({
						...config,
						diagnosticCodesToIgnore: [...TS_LINTER_DIAGNOSTIC_CODES_IGNORE],
					})
				: [];
		},
		{
			// Empty set => no lint hover tooltip (see @codemirror/lint LintConfig.tooltipFilter).
			tooltipFilter: () => [],
		},
	);
}

const zodShimSource = `export interface ZodType<TOutput = unknown> {
	optional(): ZodType<TOutput | undefined>;
	nullable(): ZodType<TOutput | null>;
}

type InferValue<TSchema extends ZodType<unknown>> =
	TSchema extends ZodType<infer TOutput> ? TOutput : never;

type ZodShape = Record<string, ZodType<unknown>>;

export interface ZodString extends ZodType<string> {}
export interface ZodNumber extends ZodType<number> {}
export interface ZodBoolean extends ZodType<boolean> {}
export interface ZodArray<TItem extends ZodType<unknown>>
	extends ZodType<Array<InferValue<TItem>>> {}
export interface ZodEnum<TValues extends readonly string[]>
	extends ZodType<TValues[number]> {}
export interface ZodObject<TShape extends ZodShape>
	extends ZodType<{ [K in keyof TShape]: InferValue<TShape[K]> }> {}

export const z: {
	string(): ZodString;
	number(): ZodNumber;
	boolean(): ZodBoolean;
	array<TItem extends ZodType<unknown>>(item: TItem): ZodArray<TItem>;
	enum<TValues extends readonly string[]>(values: TValues): ZodEnum<TValues>;
	object<TShape extends ZodShape>(shape: TShape): ZodObject<TShape>;
};

export namespace z {
	export type infer<TSchema extends ZodType<unknown>> = InferValue<TSchema>;
}
`;

const cmPopupCardStyles = {
	maxWidth: "400px",
	backgroundColor: "var(--colors-surface)",
	color: "var(--colors-text)",
	border: "1px solid var(--colors-border)",
	borderRadius: "10px",
	boxShadow: "var(--shadows-2xl)",
} as const;

const cmLintMarkerPalette = {
	light: {
		error:
			'<circle cx="20" cy="20" r="15" fill="#fecdd3" stroke="#fb7185" stroke-width="5"/>',
		warning:
			'<path fill="#fef9c3" stroke="#fde047" stroke-width="5" stroke-linejoin="round" d="M20 6L37 35L3 35Z"/>',
		info: '<path fill="#e0e7ff" stroke="#a5b4fc" stroke-width="5" stroke-linejoin="round" d="M5 5L35 5L35 35L5 35Z"/>',
	},
	dark: {
		error:
			'<circle cx="20" cy="20" r="15" fill="#3d1f26" stroke="#e06c75" stroke-width="5"/>',
		warning:
			'<path fill="#3d311f" stroke="#e5c07b" stroke-width="5" stroke-linejoin="round" d="M20 6L37 35L3 35Z"/>',
		info: '<path fill="#1f3342" stroke="#61afef" stroke-width="5" stroke-linejoin="round" d="M5 5L35 5L35 35L5 35Z"/>',
	},
} as const;

function cmLintMarkerSvg(pathInner: string): string {
	return `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${encodeURIComponent(pathInner)}</svg>')`;
}

function getDemoSyntaxTheme(isDark: boolean): Extension {
	return isDark ? cmOneDarkTheme : clouds;
}

function createEditorTheme(isDark: boolean): Extension {
	const lintPalette = isDark ? cmLintMarkerPalette.dark : cmLintMarkerPalette.light;

	return EditorView.theme({
		"&": {
			fontSize: "14px",
		},
		[`.${cm.scroller}`]: {
			fontFamily: siteMonoFontFamilyCssVar,
			lineHeight: "1.6",
		},
		[`.${cm.gutters}`]: {
			border: "none",
			// Inset fold + line-number gutters from the editor card edge.
			padding: "0 8px 0 10px",
		},
		// Slightly more horizontal padding than CodeMirror’s default `0 3px 0 5px`.
		".cm-lineNumbers .cm-gutterElement": {
			padding: "0 6px 0 8px",
		},
		".cm-foldGutter span": {
			fontSize: "18px",
			lineHeight: "1",
			padding: "0 3px",
			cursor: "pointer",
		},
		[`.${cm.content}`]: {
			padding: "16px 0",
		},
		[`.${cm.line}`]: {
			padding: "0 16px",
			fontSize: "14px",
		},
		[`.${cm.lintMarkerError}`]: {
			content: cmLintMarkerSvg(lintPalette.error),
		},
		[`.${cm.lintMarkerWarning}`]: {
			content: cmLintMarkerSvg(lintPalette.warning),
		},
		[`.${cm.lintMarkerInfo}`]: {
			content: cmLintMarkerSvg(lintPalette.info),
		},
		[`.${cm.tooltip}`]: {
			...cmPopupCardStyles,
			padding: "10px 12px",
			fontSize: "12px",
			lineHeight: "1.55",
		},
		[`.${cm.tooltip}.${cm.tooltipLint}`]: {
			listStyle: "none",
			margin: "0",
			padding: "10px 12px",
			fontSize: "calc(14px + 2pt)",
			lineHeight: "1.55",
		},
		[`.${cm.tooltip}.${cm.tooltipLint} .${cm.diagnosticText}`]: {
			fontSize: "calc(1em - 2px)",
		},
		[`.${cm.tooltip}.${cm.tooltipHover}`]: {
			maxHeight: "min(320px, 70vh)",
			overflowY: "auto",
		},
		[`.${cm.tooltipSection}:not(:first-child)`]: {
			borderTop: "1px solid var(--colors-border)",
			paddingTop: "8px",
			marginTop: "8px",
		},
		[`.${cm.tooltip}.${cm.tooltipAutocomplete}`]: {
			padding: "6px 4px",
		},
		[`.${cm.tooltip}.${cm.tooltipAutocomplete} > ul`]: {
			maxWidth: "min(400px, 95vw)",
			borderRadius: "6px",
			backgroundColor: "var(--colors-surface)",
		},
		[`.${cm.tooltip}.${cm.tooltipAutocomplete} ul li[aria-selected]`]: {
			background: "color-mix(in srgb, var(--colors-accent) 18%, transparent)",
			color: "var(--colors-text)",
		},
		[`.${cm.tooltip}.${cm.tooltipAutocompleteDisabled} ul li[aria-selected]`]: {
			background: "color-mix(in srgb, var(--colors-muted) 24%, transparent)",
			color: "var(--colors-muted)",
		},
		[`.${cm.tooltip}.${cm.completionInfo}`]: {
			...cmPopupCardStyles,
			padding: "10px 12px",
			fontSize: "12px",
			lineHeight: "1.55",
		},
		[`.${cm.tooltipAbove} .${cm.tooltipArrow}`]: {
			"&:before": {
				borderTopColor: "var(--colors-border)",
			},
			"&:after": {
				borderTopColor: "var(--colors-surface)",
			},
		},
		[`.${cm.tooltipBelow} .${cm.tooltipArrow}`]: {
			"&:before": {
				borderBottomColor: "var(--colors-border)",
			},
			"&:after": {
				borderBottomColor: "var(--colors-surface)",
			},
		},
		[`@keyframes ${cm.keyframeTooltipIn}`]: {
			"0%": { opacity: 0, transform: "scale(0.97)" },
			"100%": { opacity: 1, transform: "scale(1)" },
		},
		[`@keyframes ${cm.keyframeTooltipOut}`]: {
			"0%": { opacity: 1, transform: "scale(1)" },
			"100%": { opacity: 0, transform: "scale(0.97)" },
		},
		[`.${cm.tooltip}.${cm.tooltipMotionEnter}`]: {
			animation: `${cm.keyframeTooltipIn} 0.18s cubic-bezier(0.16, 1, 0.3, 1) both`,
			transformOrigin: "center center",
		},
		[`.${cm.tooltip}.${cm.tooltipMotionLeave}`]: {
			animation: `${cm.keyframeTooltipOut} 0.2s cubic-bezier(0.4, 0, 1, 1) both`,
			transformOrigin: "center center",
			pointerEvents: "none",
		},
		// Tooltip `prefers-reduced-motion`: `demoPlaygroundResetButton.css` (nested `@media` in this object breaks Panda codegen).
		// Active-line background only when focused (CodeMirror still decorates the line when blurred).
		"&:not(.cm-focused) .cm-activeLine": {
			backgroundColor: "transparent",
		},
		"&:not(.cm-focused) .cm-activeLineGutter": {
			backgroundColor: "transparent",
		},
	});
}

function isDarkSiteColorMode(): boolean {
	return (
		document.documentElement.getAttribute(SITE_COLOR_MODE_ATTR) ===
		SITE_COLOR_MODE_DARK
	);
}

function reconfigureDemoThemes(view: EditorView, isDark: boolean): void {
	view.dispatch({
		effects: [
			demoSyntaxThemeCompartment.reconfigure(getDemoSyntaxTheme(isDark)),
			demoEditorChromeCompartment.reconfigure(createEditorTheme(isDark)),
		],
	});
}

const TOOLTIP_LEAVE_MS = 260;

function isTooltipMotionTarget(el: HTMLElement): boolean {
	return (
		el.classList.contains(cm.tooltip) || el.classList.contains(cm.tooltipLint)
	);
}

/** Two `requestAnimationFrame` ticks so enter animations run after paint (avoids “fully formed” first frame). */
function scheduleTooltipEnter(node: HTMLElement): void {
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			if (!node.isConnected) {
				return;
			}
			node.classList.add(cm.tooltipMotionEnter);
		});
	});
}

function snapshotTooltipPaint(
	cs: CSSStyleDeclaration,
): Partial<CSSStyleDeclaration> {
	return {
		backgroundColor: cs.backgroundColor,
		border: cs.border,
		borderRadius: cs.borderRadius,
		boxShadow: cs.boxShadow,
		color: cs.color,
		fontSize: cs.fontSize,
		fontFamily: cs.fontFamily,
		padding: cs.padding,
		maxWidth: cs.maxWidth,
	};
}

function prefersReducedMotion(): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * CodeMirror removes tooltip nodes synchronously; we observe removals, re-parent to `document.body`,
 * run the leave animation, then remove the node.
 */
const demoTooltipMotionPlugin = ViewPlugin.fromClass(
	class {
		private readonly lastRects = new WeakMap<HTMLElement, DOMRect>();
		private readonly lastPaint = new WeakMap<
			HTMLElement,
			Partial<CSSStyleDeclaration>
		>();
		private rafId = 0;
		private readonly observer: MutationObserver;

		constructor(readonly view: EditorView) {
			this.observer = new MutationObserver((mutations) => {
				const reduced = prefersReducedMotion();
				for (const m of mutations) {
					for (const node of m.addedNodes) {
						if (!(node instanceof HTMLElement)) {
							continue;
						}
						if (node.classList.contains(cm.tooltipLint)) {
							continue;
						}
						if (!isTooltipMotionTarget(node)) {
							continue;
						}
						if (!reduced) {
							scheduleTooltipEnter(node);
						}
						this.ensureRectLoop();
					}
					for (const node of m.removedNodes) {
						if (!(node instanceof HTMLElement)) {
							continue;
						}
						if (node.classList.contains(cm.tooltipLint)) {
							continue;
						}
						if (!isTooltipMotionTarget(node)) {
							continue;
						}
						const rect = this.lastRects.get(node);
						const paint = this.lastPaint.get(node);
						this.lastRects.delete(node);
						this.lastPaint.delete(node);
						if (reduced) {
							continue;
						}
						if (!rect || rect.width < 1 || rect.height < 1) {
							continue;
						}
						node.classList.remove(cm.tooltipMotionEnter);
						document.body.appendChild(node);
						Object.assign(node.style, paint, {
							position: "fixed",
							left: `${rect.left}px`,
							top: `${rect.top}px`,
							width: `${rect.width}px`,
							margin: "0",
							zIndex: "10000",
						});
						node.classList.add(cm.tooltipMotionLeave);
						const finish = () => {
							node.removeEventListener("animationend", finish);
							window.clearTimeout(fallback);
							node.remove();
						};
						const fallback = window.setTimeout(finish, TOOLTIP_LEAVE_MS);
						node.addEventListener("animationend", finish);
					}
				}
			});
			this.observer.observe(this.view.dom, { childList: true, subtree: true });
			this.ensureRectLoop();
		}

		private readonly tick = () => {
			if (!this.view.dom.isConnected) {
				this.rafId = 0;
				return;
			}
			for (const el of this.view.dom.querySelectorAll(
				cmDemoTooltipQuerySelectorList,
			)) {
				if (el instanceof HTMLElement) {
					this.lastRects.set(el, el.getBoundingClientRect());
					this.lastPaint.set(el, snapshotTooltipPaint(getComputedStyle(el)));
				}
			}
			const hasTip =
				this.view.dom.querySelector(cmDemoTooltipQuerySelectorList) !== null;
			this.rafId = hasTip ? requestAnimationFrame(this.tick) : 0;
		};

		private ensureRectLoop() {
			if (this.rafId !== 0) {
				return;
			}
			this.rafId = requestAnimationFrame(this.tick);
		}

		destroy() {
			cancelAnimationFrame(this.rafId);
			this.observer.disconnect();
		}
	},
);

function toVirtualPath(fileName: string): string {
	return fileName.startsWith("/") ? fileName : `/${fileName}`;
}

function isTypeScriptFile(fileName: string): boolean {
	return /\.d?\.(?:ts|tsx)$/.test(fileName);
}

function createCompilerOptions(ts: TypeScriptApi) {
	return {
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		allowImportingTsExtensions: true,
		noEmit: true,
		strict: true,
		esModuleInterop: true,
		baseUrl: "/",
	};
}

function createWorkspaceFiles(): Record<string, string> {
	const MOCK_PACKAGE_INDEX =
		"playground_modules/haustle-notion-orm/index.ts" as const;
	const MOCK_PACKAGE_NOTION_ID_PATTERNS =
		"playground_modules/haustle-notion-orm/notion-id-patterns.ts" as const;
	const MOCK_PACKAGE_BASE =
		"playground_modules/haustle-notion-orm/build/src/base.ts" as const;
	const MOCK_PACKAGE_PREFIX = "playground_modules/" as const;

	const hiddenSupportFiles = [
		[
			"/node_modules/@haustle/notion-orm/index.ts",
			playgroundFiles[MOCK_PACKAGE_INDEX],
		],
		[
			"/node_modules/@haustle/notion-orm/notion-id-patterns.ts",
			playgroundFiles[MOCK_PACKAGE_NOTION_ID_PATTERNS],
		],
		[
			"/node_modules/@haustle/notion-orm/build/src/base.ts",
			playgroundFiles[MOCK_PACKAGE_BASE],
		],
		[
			"/node_modules/@haustle/notion-orm/package.json",
			JSON.stringify(
				{
					name: "@haustle/notion-orm",
					type: "module",
					exports: {
						".": "./index.ts",
						"./build/src/base": "./build/src/base.ts",
					},
				},
				null,
				2,
			),
		],
		["/node_modules/zod/index.d.ts", zodShimSource],
		[
			"/node_modules/zod/package.json",
			JSON.stringify(
				{
					name: "zod",
					types: "./index.d.ts",
					exports: {
						".": "./index.d.ts",
					},
				},
				null,
				2,
			),
		],
	] as const;

	return Object.fromEntries([
		...Object.entries(playgroundFiles)
			.filter(([fileName]) => !fileName.startsWith(MOCK_PACKAGE_PREFIX))
			.map(([fileName, content]) => [toVirtualPath(fileName), content]),
		...hiddenSupportFiles,
	]);
}

async function createTypeScriptEnvironment() {
	const [
		{
			createDefaultMapFromCDN,
			createSystem,
			createVirtualTypeScriptEnvironment,
		},
		tsModule,
	] = await Promise.all([import("@typescript/vfs"), import("typescript")]);
	const ts = tsModule.default;
	const compilerOptions = createCompilerOptions(ts);
	const workspaceFiles = createWorkspaceFiles();
	const fsMap = await createDefaultMapFromCDN(
		compilerOptions,
		ts.version,
		true,
		ts,
	);

	for (const [fileName, content] of Object.entries(workspaceFiles)) {
		fsMap.set(fileName, content);
	}

	const rootFiles = Object.keys(workspaceFiles).filter(isTypeScriptFile);
	const system = createSystem(fsMap);
	const env = createVirtualTypeScriptEnvironment(
		system,
		rootFiles,
		ts,
		compilerOptions,
	);

	return { env };
}

function createEditorExtensions(
	env: VirtualTypeScriptEnvironment,
	editorPath: string,
	isDark: boolean,
) {
	return [
		lineNumbers(),
		highlightActiveLineGutter(),
		highlightSpecialChars(),
		history(),
		drawSelection(),
		dropCursor(),
		indentOnInput(),
		demoSyntaxThemeCompartment.of(getDemoSyntaxTheme(isDark)),
		bracketMatching(),
		closeBrackets(),
		foldGutter(),
		lintGutter(),
		javascript({ typescript: true }),
		EditorState.tabSize.of(2),
		demoEditorChromeCompartment.of(createEditorTheme(isDark)),
		demoTooltipMotionPlugin,
		keymap.of([
			indentWithTab,
			...defaultKeymap,
			...historyKeymap,
			...closeBracketsKeymap,
			...completionKeymap,
			...foldKeymap,
			...lintKeymap,
		]),
		tsFacet.of({ env, path: editorPath }),
		tsSync(),
		typeScriptLinterExtension(),
		autocompletion({
			override: [ideLikeTsAutocomplete()],
			icons: false,
		}),
		tsHover(),
		highlightActiveLine(),
	];
}

function foldAllFoldable(view: EditorView): void {
	ensureSyntaxTree(view.state, view.state.doc.length, 5000);
	foldAll(view);
}

function resetEditorToInitial(
	view: EditorView,
	entryFileKey: keyof typeof playgroundFiles,
): void {
	const initial = playgroundFiles[entryFileKey];
	view.dispatch({
		changes: { from: 0, to: view.state.doc.length, insert: initial },
	});
	queueMicrotask(() => {
		foldAllFoldable(view);
	});
}

type DemoPlaygroundEditorChromeArgs = {
	label: string;
	resetAriaLabel: string;
	apiReferenceHref: string;
	apiReferenceAriaLabel: string;
	entryFileKey: keyof typeof playgroundFiles;
	viewRef: MutableRefObject<EditorView | null>;
	containerRef: RefObject<HTMLDivElement | null>;
	wrapperExtraClass?: string;
	status: "loading" | "ready" | "error";
	errorMessage: string | null;
};

function demoPlaygroundEditorChrome(args: DemoPlaygroundEditorChromeArgs) {
	return (
		<div className={cx(wrapperClass, args.wrapperExtraClass)}>
			<div className={headerClass}>
				<div className={headerTitleGroupClass}>
					<span className={fileLabelClass}>{args.label}</span>
					<span className={headerBulletClass} aria-hidden>
						·
					</span>
					<Link
						href={args.apiReferenceHref}
						className={apiReferenceLinkClass}
						aria-label={args.apiReferenceAriaLabel}>
						Docs
					</Link>
				</div>
				<div className={headerActionsClass}>
					<button
						type="button"
						className={cx(resetButtonClass, DEMO_PLAYGROUND_RESET_BUTTON_CLASS)}
						disabled={args.status !== "ready"}
						aria-label={args.resetAriaLabel}
						onClick={() => {
							const view = args.viewRef.current;
							if (view) {
								resetEditorToInitial(view, args.entryFileKey);
							}
						}}>
						Reset
					</button>
				</div>
			</div>
			<div
				ref={args.containerRef}
				className={cx(
					editorContainerClass,
					(args.status === "loading" || args.status === "error") &&
						editorContainerPlaceholderClass,
				)}>
				{args.status === "loading" && (
					<div className={loadingOverlayClass}>
						Loading CodeMirror and TypeScript...
					</div>
				)}
				{args.status === "error" && (
					<div className={loadingOverlayClass}>
						{args.errorMessage ?? "Unable to load the editor."}
					</div>
				)}
			</div>
		</div>
	);
}

export function DemoPlayground() {
	const databasesContainerRef = useRef<HTMLDivElement>(null);
	const agentsContainerRef = useRef<HTMLDivElement>(null);
	const databasesViewRef = useRef<EditorView | null>(null);
	const agentsViewRef = useRef<EditorView | null>(null);
	const [status, setStatus] = useState<"loading" | "ready" | "error">(
		"loading",
	);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	useEffect(() => {
		let disposed = false;
		let colorModeObserver: MutationObserver | null = null;

		async function mount() {
			const databasesContainer = databasesContainerRef.current;
			const agentsContainer = agentsContainerRef.current;
			if (!databasesContainer || !agentsContainer) {
				return;
			}

			try {
				const { env } = await createTypeScriptEnvironment();

				if (disposed) {
					return;
				}

				const databasesPath = toVirtualPath(databaseEntryFile);
				const agentsPath = toVirtualPath(agentEntryFile);
				let isDark = isDarkSiteColorMode();

				const databasesView = new EditorView({
					state: EditorState.create({
						doc: playgroundFiles[databaseEntryFile],
						extensions: createEditorExtensions(env, databasesPath, isDark),
					}),
					parent: databasesContainer,
				});

				const agentsView = new EditorView({
					state: EditorState.create({
						doc: playgroundFiles[agentEntryFile],
						extensions: createEditorExtensions(env, agentsPath, isDark),
					}),
					parent: agentsContainer,
				});

				colorModeObserver = new MutationObserver(() => {
					const nextIsDark = isDarkSiteColorMode();
					if (nextIsDark === isDark) {
						return;
					}
					isDark = nextIsDark;
					reconfigureDemoThemes(databasesView, nextIsDark);
					reconfigureDemoThemes(agentsView, nextIsDark);
				});
				colorModeObserver.observe(document.documentElement, {
					attributes: true,
					attributeFilter: [SITE_COLOR_MODE_ATTR],
				});

				databasesViewRef.current = databasesView;
				agentsViewRef.current = agentsView;
				setStatus("ready");
				queueMicrotask(() => {
					foldAllFoldable(databasesView);
					foldAllFoldable(agentsView);
				});
			} catch (error) {
				if (disposed) {
					return;
				}

				const message =
					error instanceof Error
						? error.message
						: "Unable to load the TypeScript editor.";
				setErrorMessage(message);
				setStatus("error");
			}
		}

		void mount();

		return () => {
			disposed = true;
			colorModeObserver?.disconnect();
			databasesViewRef.current?.destroy();
			agentsViewRef.current?.destroy();
			databasesViewRef.current = null;
			agentsViewRef.current = null;
		};
	}, []);

	const databasesPanel = demoPlaygroundPanelMeta[0];
	const agentsPanel = demoPlaygroundPanelMeta[1];

	return (
		<>
			{demoPlaygroundEditorChrome({
				label: databasesPanel.label,
				resetAriaLabel: databasesPanel.resetAriaLabel,
				apiReferenceHref: databasesPanel.apiReferenceHref,
				apiReferenceAriaLabel: databasesPanel.apiReferenceAriaLabel,
				entryFileKey: databaseEntryFile,
				viewRef: databasesViewRef,
				containerRef: databasesContainerRef,
				status,
				errorMessage,
			})}
			{demoPlaygroundEditorChrome({
				label: agentsPanel.label,
				resetAriaLabel: agentsPanel.resetAriaLabel,
				apiReferenceHref: agentsPanel.apiReferenceHref,
				apiReferenceAriaLabel: agentsPanel.apiReferenceAriaLabel,
				entryFileKey: agentEntryFile,
				viewRef: agentsViewRef,
				containerRef: agentsContainerRef,
				wrapperExtraClass: sectionGapClass,
				status,
				errorMessage,
			})}
		</>
	);
}
