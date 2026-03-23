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
import { EditorState } from "@codemirror/state";
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
import { css, cx } from "../../styled-system/css";
import {
	cmDemoSiteClassNames as cm,
	cmDemoTooltipQuerySelectorList,
	DEMO_PLAYGROUND_RESET_BUTTON_CLASS,
	siteMonoFontFamilyCssVar,
} from "../siteClassNames";
import { ideLikeTsAutocomplete } from "./ideLikeTsAutocomplete";
import {
	agentEntryFile,
	databaseEntryFile,
	playgroundFiles,
} from "./playgroundFiles";

type TypeScriptApi = typeof import("typescript");

const TS_LINTER_DIAGNOSTIC_CODES_IGNORE = [1375, 1378, 2792, 2821] as const;

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
			// @ts-expect-error: null means “no tooltip” per runtime; types don’t allow it.
			tooltipFilter: () => null,
		},
	);
}

const wrapperClass = css({
	mt: "8",
	mb: "0",
	bg: "transparent",
});

const sectionGapClass = css({
	mt: "10",
});

const headerClass = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	px: "4",
	py: "2.5",
	bg: "transparent",
	fontSize: "xs",
	color: "muted",
	letterSpacing: "0.08em",
});

const fileLabelClass = css({
	fontFamily: "mono",
	fontSize: "xs",
	color: "text",
	fontWeight: "500",
});

const headerTitleGroupClass = css({
	display: "flex",
	alignItems: "baseline",
	gap: "2",
	flexWrap: "wrap",
	minW: "0",
});

const headerBulletClass = css({
	color: "muted",
	userSelect: "none",
});

const apiReferenceLinkClass = css({
	fontFamily: "inherit",
	fontSize: "xs",
	color: "muted",
	textDecoration: "underline",
	textUnderlineOffset: "2px",
	letterSpacing: "0.06em",
	_hover: {
		color: "text",
	},
});

const headerActionsClass = css({
	display: "flex",
	alignItems: "center",
	gap: "3",
});

const resetButtonClass = css({
	fontSize: "xs",
	fontFamily: "inherit",
	color: "muted",
	backgroundColor: "transparent",
	borderWidth: "1px",
	borderStyle: "solid",
	borderColor: "border",
	borderRadius: "6px",
	padding: "3px 8px",
	cursor: "pointer",
	transformOrigin: "center",
	transform: "scale(1)",
	transition:
		"background-color 0.15s, border-color 0.15s, color 0.15s, transform 0.22s cubic-bezier(0.34, 1.45, 0.64, 1)",
	_hover: {
		color: "text",
		borderColor: "muted",
		backgroundColor: "background",
		transform: "scale(1.05)",
	},
	_active: {
		transform: "scale(0.96)",
		transition:
			"background-color 0.15s, border-color 0.15s, color 0.15s, transform 0.1s cubic-bezier(0.34, 1.8, 0.64, 1)",
	},
	_disabled: {
		opacity: "0.45",
		cursor: "not-allowed",
		transform: "scale(1)",
	},
});

const editorContainerClass = css({
	position: "relative",
	bg: "background",
	borderWidth: "1px",
	borderColor: "border",
	borderRadius: "12px",
	overflow: "hidden",
});

/** Only applied while loading/error so the shell doesn’t keep a 480px min-height once the editor sizes to content. */
const editorContainerPlaceholderClass = css({
	minHeight: "480px",
});

const loadingOverlayClass = css({
	position: "absolute",
	inset: "0",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	bg: "background",
	color: "muted",
	fontFamily: "mono",
	fontSize: "sm",
	zIndex: 2,
});

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

const cmPopupCardLight = {
	maxWidth: "400px",
	backgroundColor: "#ffffff",
	color: "#171717",
	border: "1px solid rgba(0, 0, 0, 0.08)",
	borderRadius: "10px",
	boxShadow: "0 4px 24px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.05)",
} as const;

/** `content:` URL for `@codemirror/lint` gutter markers (light demo theme). */
function cmLintMarkerSvg(pathInner: string): string {
	return `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${encodeURIComponent(pathInner)}</svg>')`;
}

const editorTheme = EditorView.theme(
	{
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
			content: cmLintMarkerSvg(
				'<circle cx="20" cy="20" r="15" fill="#fecdd3" stroke="#fb7185" stroke-width="5"/>',
			),
		},
		[`.${cm.lintMarkerWarning}`]: {
			content: cmLintMarkerSvg(
				'<path fill="#fef9c3" stroke="#fde047" stroke-width="5" stroke-linejoin="round" d="M20 6L37 35L3 35Z"/>',
			),
		},
		[`.${cm.lintMarkerInfo}`]: {
			content: cmLintMarkerSvg(
				'<path fill="#e0e7ff" stroke="#a5b4fc" stroke-width="5" stroke-linejoin="round" d="M5 5L35 5L35 35L5 35Z"/>',
			),
		},
		[`.${cm.tooltip}`]: {
			...cmPopupCardLight,
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
			borderTop: "1px solid rgba(0, 0, 0, 0.06)",
			paddingTop: "8px",
			marginTop: "8px",
		},
		[`.${cm.tooltip}.${cm.tooltipAutocomplete}`]: {
			padding: "6px 4px",
		},
		[`.${cm.tooltip}.${cm.tooltipAutocomplete} > ul`]: {
			maxWidth: "min(400px, 95vw)",
			borderRadius: "6px",
		},
		[`.${cm.tooltip}.${cm.tooltipAutocomplete} ul li[aria-selected]`]: {
			background: "rgba(37, 99, 235, 0.12)",
			color: "#1e3a8a",
		},
		[`.${cm.tooltip}.${cm.tooltipAutocompleteDisabled} ul li[aria-selected]`]: {
			background: "rgba(113, 113, 122, 0.2)",
			color: "#3f3f46",
		},
		[`.${cm.tooltip}.${cm.completionInfo}`]: {
			...cmPopupCardLight,
			padding: "10px 12px",
			fontSize: "12px",
			lineHeight: "1.55",
		},
		[`.${cm.tooltipAbove} .${cm.tooltipArrow}`]: {
			"&:before": {
				borderTopColor: "rgba(0, 0, 0, 0.12)",
			},
			"&:after": {
				borderTopColor: "#ffffff",
			},
		},
		[`.${cm.tooltipBelow} .${cm.tooltipArrow}`]: {
			"&:before": {
				borderBottomColor: "rgba(0, 0, 0, 0.12)",
			},
			"&:after": {
				borderBottomColor: "#ffffff",
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
	},
	{ dark: false },
);

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
	const MOCK_PACKAGE_BASE =
		"playground_modules/haustle-notion-orm/build/src/base.ts" as const;
	const MOCK_PACKAGE_PREFIX = "playground_modules/" as const;

	const hiddenSupportFiles = [
		[
			"/node_modules/@haustle/notion-orm/index.ts",
			playgroundFiles[MOCK_PACKAGE_INDEX],
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
) {
	return [
		lineNumbers(),
		highlightActiveLineGutter(),
		highlightSpecialChars(),
		history(),
		drawSelection(),
		dropCursor(),
		indentOnInput(),
		clouds,
		bracketMatching(),
		closeBrackets(),
		foldGutter(),
		lintGutter(),
		javascript({ typescript: true }),
		EditorState.tabSize.of(2),
		editorTheme,
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

				const databasesView = new EditorView({
					state: EditorState.create({
						doc: playgroundFiles[databaseEntryFile],
						extensions: createEditorExtensions(env, databasesPath),
					}),
					parent: databasesContainer,
				});

				const agentsView = new EditorView({
					state: EditorState.create({
						doc: playgroundFiles[agentEntryFile],
						extensions: createEditorExtensions(env, agentsPath),
					}),
					parent: agentsContainer,
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
			databasesViewRef.current?.destroy();
			agentsViewRef.current?.destroy();
			databasesViewRef.current = null;
			agentsViewRef.current = null;
		};
	}, []);

	const editorChrome = (args: {
		label: string;
		resetAriaLabel: string;
		apiReferenceHref: string;
		apiReferenceAriaLabel: string;
		entryFileKey: keyof typeof playgroundFiles;
		viewRef: MutableRefObject<EditorView | null>;
		containerRef: RefObject<HTMLDivElement | null>;
		wrapperExtraClass?: string;
	}) => (
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
						disabled={status !== "ready"}
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
					(status === "loading" || status === "error") &&
						editorContainerPlaceholderClass,
				)}>
				{status === "loading" && (
					<div className={loadingOverlayClass}>
						Loading CodeMirror and TypeScript...
					</div>
				)}
				{status === "error" && (
					<div className={loadingOverlayClass}>
						{errorMessage ?? "Unable to load the editor."}
					</div>
				)}
			</div>
		</div>
	);

	return (
		<>
			{editorChrome({
				label: "Databases",
				resetAriaLabel: "Reset database demo to default code",
				apiReferenceHref: "/api-reference#database-client",
				apiReferenceAriaLabel: "Database client API reference",
				entryFileKey: databaseEntryFile,
				viewRef: databasesViewRef,
				containerRef: databasesContainerRef,
			})}
			{editorChrome({
				label: "Agents",
				resetAriaLabel: "Reset agent demo to default code",
				apiReferenceHref: "/api-reference#agent-client",
				apiReferenceAriaLabel: "Agent client API reference",
				entryFileKey: agentEntryFile,
				viewRef: agentsViewRef,
				containerRef: agentsContainerRef,
				wrapperExtraClass: sectionGapClass,
			})}
		</>
	);
}
