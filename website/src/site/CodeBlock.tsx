"use client";

import { IconCheckmark1Small } from "@central-icons-react/round-outlined-radius-3-stroke-2/IconCheckmark1Small";
import { IconClipboard } from "@central-icons-react/round-outlined-radius-3-stroke-2/IconClipboard";
import { IconCode } from "@central-icons-react/round-outlined-radius-3-stroke-2/IconCode";
import { IconConsoleSimple } from "@central-icons-react/round-outlined-radius-3-stroke-2/IconConsoleSimple";
import { IconFileText } from "@central-icons-react/round-outlined-radius-3-stroke-2/IconFileText";
import { IconTypescript } from "@central-icons-react/round-outlined-radius-3-stroke-2/IconTypescript";
import { Highlight } from "prism-react-renderer";
import {
	type FC,
	isValidElement,
	type ReactNode,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { css, cx } from "../styled-system/css";
import { Prism } from "./codeBlockPrismRegister";
import { getSiteCodeBlockPrismTheme } from "./codeBlockPrismTheme";
import {
	mdxFenceLanguageToPrism,
	prismHasGrammar,
} from "./mdxFenceLanguageToPrism";
import {
	isSiteCodeDarkForPrism,
	useSiteCodeBlockColorMode,
} from "./useSiteCodeBlockColorMode";

interface CodeBlockProps {
	children?: ReactNode;
}

interface CodeBlockData {
	code: string;
	fileLabel: string | null;
	caption: string | null;
	language: string | null;
}

const jsFamilyLanguages = new Set([
	"ts",
	"tsx",
	"js",
	"jsx",
	"typescript",
	"javascript",
]);

const terminalLanguages = new Set([
	"bash",
	"sh",
	"zsh",
	"shell",
	"terminal",
	"powershell",
	"ps1",
	"pwsh",
]);

/** Default label when the block has no `// file:` / frontmatter `data-file` (short path-like or “Terminal”). */
function defaultCodeBlockTitle(language: string | null): string {
	if (language) {
		const lang = language.toLowerCase();
		if (terminalLanguages.has(lang)) {
			return "Terminal";
		}
		if (lang === "ts" || lang === "tsx" || lang === "typescript") {
			return "index.ts";
		}
		if (
			lang === "js" ||
			lang === "jsx" ||
			lang === "javascript" ||
			lang === "mjs" ||
			lang === "cjs"
		) {
			return "index.js";
		}
		if (lang === "txt" || lang === "text") {
			return "generated_tree.txt";
		}
		if (lang === "json" || lang === "jsonc") {
			return "data.json";
		}
		if (lang === "yaml" || lang === "yml") {
			return "config.yaml";
		}
	}
	return "index.ts";
}

const CODE_BLOCK_HEADER_ICON_PX = 15 as const;
const codeBlockHeaderIconA11y = { "aria-hidden": true as const };

/** Fences used in site `content` MDX today — extend when you add a new language. */
const codeBlockHeaderIcons = {
	ts: IconTypescript,
	bash: IconConsoleSimple,
	txt: IconFileText,
} as const;

type CodeBlockHeaderIconKey = keyof typeof codeBlockHeaderIcons;

function isCodeBlockHeaderIconKey(
	value: string,
): value is CodeBlockHeaderIconKey {
	return value === "ts" || value === "bash" || value === "txt";
}

function CodeBlockHeaderIcon({ language }: { language: string | null }) {
	const p = { size: CODE_BLOCK_HEADER_ICON_PX, ...codeBlockHeaderIconA11y };
	const L = language?.toLowerCase();
	if (!L) {
		return <IconTypescript {...p} />;
	}
	if (isCodeBlockHeaderIconKey(L)) {
		const Icon = codeBlockHeaderIcons[L];
		return <Icon {...p} />;
	}
	return <IconCode {...p} />;
}

function normalizeCaption(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function inferCaptionFromCode(
	code: string,
	language: string | null,
): { fileLabel: string | null; caption: string | null; code: string } {
	if (!language) {
		return { fileLabel: null, caption: null, code };
	}

	if (!jsFamilyLanguages.has(language.toLowerCase())) {
		return { fileLabel: null, caption: null, code };
	}

	const lines = code.split("\n");
	const directiveLineRegex = /^\/\/\s*(.+)\s*$/;
	const explicitCaptionRegex = /^(?:@?caption)\s*:\s*(.+)$/;
	const explicitFileRegex = /^(?:@?file)\s*:\s*(.+)$/;
	const filenameOnlyRegex = /^([A-Za-z0-9._/-]+\.[A-Za-z0-9]+(?:\s*\(.+\))?)$/;

	let fileLabel: string | null = null;
	let caption: string | null = null;
	let consumedDirectiveLines = 0;

	for (const line of lines) {
		const trimmed = line.trim();
		const directiveMatch = directiveLineRegex.exec(trimmed);
		if (!directiveMatch) {
			break;
		}

		const value = directiveMatch[1].trim();
		const fileMatch = explicitFileRegex.exec(value);
		if (fileMatch) {
			fileLabel = fileMatch[1].trim();
			consumedDirectiveLines += 1;
			continue;
		}

		const captionMatch = explicitCaptionRegex.exec(value);
		if (captionMatch) {
			caption = captionMatch[1].trim();
			consumedDirectiveLines += 1;
			continue;
		}

		const filenameMatch = filenameOnlyRegex.exec(value);
		if (filenameMatch) {
			fileLabel = filenameMatch[1].trim();
			consumedDirectiveLines += 1;
			continue;
		}

		break;
	}

	if (consumedDirectiveLines === 0) {
		return { fileLabel: null, caption: null, code };
	}

	const remaining = lines.slice(consumedDirectiveLines);
	if (remaining[0]?.trim() === "") {
		remaining.shift();
	}

	return { fileLabel, caption, code: remaining.join("\n") };
}

function getCodeBlockData(children: ReactNode): CodeBlockData | null {
	if (!isValidElement<Record<string, unknown>>(children)) {
		return null;
	}

	const className =
		typeof children.props.className === "string"
			? children.props.className
			: null;
	const language = className?.startsWith("language-")
		? className.replace("language-", "")
		: null;
	const explicitCaption =
		normalizeCaption(children.props["data-caption"]) ??
		normalizeCaption(children.props.title);
	const explicitFileLabel = normalizeCaption(children.props["data-file"]);
	const nestedChildren = children.props.children;

	if (typeof nestedChildren === "string") {
		const inferred = inferCaptionFromCode(nestedChildren, language);
		return {
			code: inferred.code,
			fileLabel: explicitFileLabel ?? inferred.fileLabel,
			caption: explicitCaption ?? inferred.caption,
			language,
		};
	}

	if (Array.isArray(nestedChildren)) {
		const textParts = nestedChildren.filter(
			(value): value is string => typeof value === "string",
		);
		const inferred = inferCaptionFromCode(textParts.join(""), language);

		return {
			code: inferred.code,
			fileLabel: explicitFileLabel ?? inferred.fileLabel,
			caption: explicitCaption ?? inferred.caption,
			language,
		};
	}

	return null;
}

const codeBlockFallbackPreClass = css({
	fontFamily: "mono",
	fontSize: "sm",
	lineHeight: "1.75",
	bg: "transparent",
	color: "text",
	borderWidth: "1px",
	borderColor: "border",
	borderRadius: "md",
	p: "6",
	overflowX: "auto",
	my: "6",
});

const codeBlockWrapperClass = css({
	mt: "6",
});

const codeBlockWrapperWithCaptionClass = css({
	mb: "8",
});

const codeBlockWrapperWithoutCaptionClass = css({
	mb: "6",
});

const codeBlockContainerClass = css({
	borderWidth: "1px",
	borderColor: "border",
	borderTopRadius: "12px",
	borderBottomRadius: "16px",
	overflow: "hidden",
	bg: "transparent",
});

const codeBlockHeaderClass = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	px: "4",
	py: "2.5",
	bg: "inlineCodeBg",
	borderBottomWidth: "1px",
	borderBottomColor: "border",
	fontSize: "xs",
	color: "muted",
	letterSpacing: "0.08em",
	columnGap: "3",
	minH: "9",
});

const codeBlockHeaderTitleRowClass = css({
	display: "flex",
	alignItems: "center",
	gap: "2",
	minW: "0",
	flex: "1",
});

const codeBlockHeaderTitleTextClass = css({
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	fontSize: "sm",
	color: "muted",
});

const codeBlockHeaderTitleIconClass = css({
	flexShrink: 0,
	color: "muted",
	"& svg": {
		display: "block",
	},
});

const codeBlockPreBaseClass = css({
	m: "0",
	px: "6",
	py: "5",
	overflowX: "auto",
	fontFamily: "mono",
	fontSize: "sm",
	lineHeight: "1.75",
});

const codeBlockPrePlainTextClass = css({
	color: "text",
});

const codeBlockCodeInnerClass = css({
	display: "block",
	w: "100%",
	p: "0",
	m: "0",
	fontFamily: "inherit",
	fontSize: "inherit",
	lineHeight: "inherit",
	color: "inherit",
	bg: "transparent",
	borderWidth: "0",
	borderRadius: "0",
});

const codeBlockLineClass = css({
	display: "block",
	whiteSpace: "pre",
});

const codeBlockCaptionClass = css({
	mt: "2.5",
	display: "block",
	mx: "25px",
	boxSizing: "border-box",
	fontSize: "sm",
	lineHeight: "1.6",
	color: "text",
	opacity: 0.7,
});

const copyButtonWrapClass = css({
	position: "relative",
	flexShrink: 0,
});

const copyButtonClass = css({
	position: "relative",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	w: "8",
	h: "8",
	p: "0",
	m: "0",
	borderWidth: "0",
	borderRadius: "md",
	cursor: "pointer",
	color: "muted",
	bg: "transparent",
	transitionProperty: "transform, color",
	transitionDuration: "0.15s",
	transitionTimingFunction: "ease",
	_hover: {
		color: "inlineCodeText",
		transform: "scale(1.08)",
	},
	_active: {
		transform: "scale(0.96)",
	},
});

const copyIconLayerClass = css({
	position: "absolute",
	inset: "0",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	transitionProperty: "opacity, transform",
	transitionDuration: "0.2s",
	transitionTimingFunction: "ease",
});

const COPY_SUCCESS_MS = 600;

/**
 * MDX fences almost always end with a trailing newline. `prism-react-renderer` normalizes
 * that into an extra empty `token-line` (`.token-line`), which reads as a bogus blank line
 * in short terminal/bash blocks.
 */
function codeBlockVisualSource(source: string): string {
	return source.replace(/(?:\r\n|\n)+$/, "");
}

export const CodeBlock: FC<CodeBlockProps> = ({ children }) => {
	const blockData = getCodeBlockData(children);
	const codeBlockColorMode = useSiteCodeBlockColorMode();
	/** `prism-react-renderer` + `prismjs` can disagree between SSR and client (tokens/DOM), so we match plain markup first, then enable Highlight before first paint. */
	const [isPrismHighlightClientReady, setIsPrismHighlightClientReady] =
		useState(false);
	const [copied, setCopied] = useState(false);
	const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearResetTimer = useCallback(() => {
		if (resetTimerRef.current !== null) {
			clearTimeout(resetTimerRef.current);
			resetTimerRef.current = null;
		}
	}, []);

	useEffect(() => {
		return () => {
			clearResetTimer();
		};
	}, [clearResetTimer]);

	// `useLayoutEffect` runs after DOM commit but before paint, so the flip to
	// client-side Prism happens in the same frame as the first render—no
	// pre-paint flash from SSR/plain markup to highlighted tokens.
	useLayoutEffect(() => {
		setIsPrismHighlightClientReady(true);
	}, []);

	const handleCopy = useCallback(async () => {
		if (!blockData) {
			return;
		}
		try {
			await navigator.clipboard.writeText(
				codeBlockVisualSource(blockData.code),
			);
		} catch {
			return;
		}
		clearResetTimer();
		setCopied(true);
		resetTimerRef.current = setTimeout(() => {
			setCopied(false);
			resetTimerRef.current = null;
		}, COPY_SUCCESS_MS);
	}, [blockData, clearResetTimer]);

	if (!blockData) {
		return <pre className={codeBlockFallbackPreClass}>{children}</pre>;
	}

	const hasCaption = blockData.caption !== null;
	const titleLabel =
		blockData.fileLabel ?? defaultCodeBlockTitle(blockData.language);

	const langLower = blockData.language?.toLowerCase() ?? null;
	const isTerminalCodeFence =
		langLower !== null && terminalLanguages.has(langLower);

	const prismId = mdxFenceLanguageToPrism(blockData.language);
	const prismHighlightLanguage =
		!isTerminalCodeFence &&
		prismId !== null &&
		prismHasGrammar(Prism, prismId)
			? prismId
			: null;
	const visualCode = codeBlockVisualSource(blockData.code);
	const isDarkMode = isSiteCodeDarkForPrism(codeBlockColorMode);
	const showPrismHighlight =
		prismHighlightLanguage !== null && isPrismHighlightClientReady;

	return (
		<div
			className={cx(
				codeBlockWrapperClass,
				hasCaption
					? codeBlockWrapperWithCaptionClass
					: codeBlockWrapperWithoutCaptionClass,
			)}>
			<div className={codeBlockContainerClass}>
				<div className={codeBlockHeaderClass}>
					<span className={codeBlockHeaderTitleRowClass}>
						<span className={codeBlockHeaderTitleIconClass}>
							<CodeBlockHeaderIcon language={blockData.language} />
						</span>
						<span className={codeBlockHeaderTitleTextClass}>{titleLabel}</span>
					</span>
					<div className={copyButtonWrapClass}>
						<button
							type="button"
							className={copyButtonClass}
							aria-label={copied ? "Copied" : "Copy code"}
							onClick={handleCopy}>
							<span
								className={copyIconLayerClass}
								style={{
									opacity: copied ? 0 : 1,
									transform: copied ? "scale(0.85)" : "scale(1)",
									pointerEvents: copied ? "none" : "auto",
								}}>
								<IconClipboard size={16} aria-hidden />
							</span>
							<span
								className={copyIconLayerClass}
								style={{
									opacity: copied ? 1 : 0,
									transform: copied ? "scale(1)" : "scale(0.85)",
									pointerEvents: copied ? "auto" : "none",
								}}>
								<IconCheckmark1Small size={18} aria-hidden />
							</span>
						</button>
					</div>
				</div>
				{showPrismHighlight ? (
					<Highlight
						language={prismHighlightLanguage}
						prism={Prism}
						code={visualCode}
						theme={getSiteCodeBlockPrismTheme(isDarkMode)}>
						{({
							className,
							style,
							tokens,
							getLineProps,
							getTokenProps,
						}) => (
							<pre
								className={cx(codeBlockPreBaseClass, className)}
								style={style}>
								<code className={codeBlockCodeInnerClass}>
									{tokens.map((line, i) => (
										<span
											// biome-ignore lint/suspicious/noArrayIndexKey: static MDX code output; line order is fixed
											key={i}
											{...getLineProps({
												line,
												className: codeBlockLineClass,
											})}>
											{line.map((token, k) => {
												const t = getTokenProps({ token });
												return (
													<span
														// biome-ignore lint/suspicious/noArrayIndexKey: static MDX code output; line order is fixed
														key={k}
														className={t.className}
														style={t.style}>
														{t.children}
													</span>
												);
											})}
										</span>
									))}
								</code>
							</pre>
						)}
					</Highlight>
				) : (
					<pre
						className={cx(
							codeBlockPreBaseClass,
							codeBlockPrePlainTextClass,
						)}>
						<code className={codeBlockCodeInnerClass}>{visualCode}</code>
					</pre>
				)}
			</div>
			{hasCaption && (
				<p className={codeBlockCaptionClass}>{blockData.caption}</p>
			)}
		</div>
	);
};
