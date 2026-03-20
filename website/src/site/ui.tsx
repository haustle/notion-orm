import {
	Children,
	type FC,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";
import { css, cx } from "../styled-system/css";
import { githubUrl, siteTitle, twitterUrl } from "./config";
import { NotionCubeLogo } from "./notion-cube-logo";
import { TocNav } from "./toc-nav";
import type { TocEntry } from "./types";

interface SidebarPage {
	path: string;
	title: string;
}

interface LayoutProps {
	children: ReactNode;
	sitePages: SidebarPage[];
	currentPath: string;
	toc: TocEntry[];
}

interface SidebarProps {
	sitePages: SidebarPage[];
	currentPath: string;
	toc: TocEntry[];
}

interface CodeBlockProps {
	children?: ReactNode;
}

interface CodeBlockData {
	code: string;
	language: string | null;
	fileLabel: string | null;
	caption: string | null;
}

const shellClass = css({
	maxW: "896px",
	mx: "auto",
	px: { base: "5", md: "8" },
	py: { base: "5", md: "8" },
});

const mobileTopNavClass = css({
	display: { base: "flex", lg: "none" },
	alignItems: "center",
	justifyContent: "space-between",
	gap: "4",
	pb: "4",
	mb: "6",
	borderBottomWidth: "1px",
	borderBottomColor: "border",
});

const layoutClass = css({
	display: "grid",
	gridTemplateColumns: { base: "1fr", lg: "180px minmax(0, 720px)" },
	columnGap: { base: "0", lg: "5.6rem" },
	justifyContent: "center",
	mt: "100px",
});

const narrowLayoutClass = css({
	gridTemplateColumns: { lg: "180px minmax(0, 540px)" },
});

const sidebarClass = css({
	display: { base: "none", lg: "flex" },
	position: "sticky",
	top: "8",
	flexDirection: "column",
	gap: "5",
	alignSelf: "start",
});

const sidebarBrandClass = css({
	display: "flex",
	alignItems: "center",
	color: "text",
	fontWeight: "600",
	fontSize: "md",
});

const sidebarBrandSectionClass = css({
	px: "3",
});

const pagesNavClass = css({
	display: "flex",
	flexDirection: "column",
	gap: "1",
	bg: { _dark: "bgDark" },
	rounded: "10",
	p: "3",
});

const tocNavClass = css({
	display: "flex",
	flexDirection: "column",
});

const contentClass = css({
	display: "flex",
	flexDirection: "column",
	gap: "8",
	minW: "0",
});

const articleClass = css({
	fontSize: "md",
	lineHeight: "1.75",
	color: "text",
});

const footerClass = css({
	display: "flex",
	justifyContent: "center",
	pt: "5",
	color: "muted",
	fontSize: "sm",
});

const footerLinkClass = css({
	color: "muted",
	textDecoration: "none",
	px: "2",
	py: "1",
	borderRadius: "full",
	transitionProperty: "background, color",
	transitionDuration: "200ms",
	_hover: {
		bg: "inlineCodeBg",
		color: "text",
	},
});

const proseStyles = {
	"& h1": {
		fontSize: { base: "3xl", md: "4xl" },
		lineHeight: "1.1",
		letterSpacing: "-0.03em",
		fontWeight: "600",
		marginTop: "0",
		marginBottom: "4",
		scrollMarginTop: "10",
	},
	"& h2": {
		fontSize: { base: "xl", md: "2xl" },
		lineHeight: "1.2",
		letterSpacing: "-0.02em",
		fontWeight: "600",
		marginTop: "10",
		marginBottom: "3",
		scrollMarginTop: "10",
	},
	"& h3": {
		fontSize: { base: "md", md: "lg" },
		lineHeight: "1.3",
		fontWeight: "600",
		marginTop: "7",
		marginBottom: "2",
		scrollMarginTop: "10",
	},
	"& h4": {
		fontSize: "base",
		lineHeight: "1.3",
		fontWeight: "600",
		marginTop: "5",
		marginBottom: "2",
		scrollMarginTop: "10",
	},
	"& p": {
		marginY: "4",
		color: "text",
	},
	"& ul": {
		marginY: "4",
		paddingLeft: "4",
		listStyleType: "disc",
	},
	"& li": {
		marginY: "1.5",
		color: "text",
		"&::marker": {
			color: "muted",
		},
	},
	"& blockquote": {
		marginY: "6",
		pl: "4",
		borderLeftWidth: "2px",
		borderLeftColor: "border",
		color: "muted",
	},
	"& hr": {
		marginY: "8",
		border: "0",
		borderTopWidth: "1px",
		borderTopColor: "border",
	},
	"& code": {
		fontSize: "0.92em",
		bg: "inlineCodeBg",
		color: "inlineCodeText",
		borderRadius: "sm",
		px: "1",
		py: "0.5",
	},
	"& pre code": {
		bg: "transparent",
		color: "inherit",
		borderWidth: "0",
		borderRadius: "0",
		px: "0",
		py: "0",
		fontSize: "inherit",
	},
	"& a": {
		color: "text",
		textDecoration: "underline",
		textUnderlineOffset: "3px",
	},
	"& table": {
		width: "100%",
		borderCollapse: "collapse",
		marginY: "4",
		fontSize: "sm",
	},
	"& th": {
		textAlign: "left",
		padding: "2",
		borderBottomWidth: "2px",
		borderBottomColor: "border",
		fontWeight: "600",
	},
	"& td": {
		padding: "2",
		borderBottomWidth: "1px",
		borderBottomColor: "border",
	},
} as const;

const languageDisplayNames: Record<string, string> = {
	bash: "Bash",
	sh: "Shell",
	zsh: "Shell",
	ts: "TypeScript",
	typescript: "TypeScript",
	js: "JavaScript",
	javascript: "JavaScript",
	json: "JSON",
	html: "HTML",
	css: "CSS",
	xml: "XML",
	sql: "SQL",
	md: "Markdown",
	markdown: "Markdown",
	py: "Python",
	python: "Python",
	text: "Plain text",
	plaintext: "Plain text",
};

function getLanguageLabel(identifier: string | null): string {
	if (!identifier) {
		return "Plain text";
	}
	const lower = identifier.toLowerCase();
	return languageDisplayNames[lower] ?? identifier;
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

	const isJsFamilyLanguage =
		language === "ts" ||
		language === "tsx" ||
		language === "js" ||
		language === "jsx" ||
		language === "typescript" ||
		language === "javascript";

	if (!isJsFamilyLanguage) {
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
			language,
			fileLabel: explicitFileLabel ?? inferred.fileLabel,
			caption: explicitCaption ?? inferred.caption,
		};
	}

	if (Array.isArray(nestedChildren)) {
		const textParts = nestedChildren.filter(
			(value): value is string => typeof value === "string",
		);
		const inferred = inferCaptionFromCode(textParts.join(""), language);

		return {
			code: inferred.code,
			language,
			fileLabel: explicitFileLabel ?? inferred.fileLabel,
			caption: explicitCaption ?? inferred.caption,
		};
	}

	return null;
}

const CodeBlock: FC<CodeBlockProps> = ({ children }) => {
	const blockData = getCodeBlockData(children);

	if (!blockData) {
		return (
			<pre
				className={css({
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
				})}>
				{children}
			</pre>
		);
	}

	const hasCaption = blockData.caption !== null;

	return (
		<div
			className={css({
				mt: "6",
				mb: hasCaption ? "8" : "6",
			})}>
			<div
				className={css({
					borderWidth: "1px",
					borderColor: "border",
					borderTopRadius: "16px",
					borderBottomRadius: "16px",
					overflow: "hidden",
					bg: "transparent",
				})}>
				<div
					className={css({
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
					})}>
					<span>{blockData.fileLabel ?? "Code"}</span>
					<span>{getLanguageLabel(blockData.language)}</span>
				</div>
				<pre
					className={css({
						m: "0",
						px: "6",
						py: "5",
						overflowX: "auto",
						fontFamily: "mono",
						fontSize: "sm",
						lineHeight: "1.75",
						color: "text",
					})}>
					<code>{blockData.code}</code>
				</pre>
			</div>
			{hasCaption && (
				<p
					className={css({
						mt: "2.5",
						px: "1",
						fontSize: "sm",
						color: "muted",
					})}>
					{blockData.caption}
				</p>
			)}
		</div>
	);
};

function collectChildren(children: ReactNode): ReactNode[] {
	const result: ReactNode[] = [];
	Children.forEach(children, (child) => result.push(child));
	return result;
}

interface ParsedTableData {
	headers: string[];
	rows: ReactNode[][];
}

function isElement(
	node: ReactNode,
): node is ReactElement<{ children?: ReactNode }> {
	return isValidElement<{ children?: ReactNode }>(node);
}

function parseTableChildren(children: ReactNode): ParsedTableData {
	const headers: string[] = [];
	const rows: ReactNode[][] = [];

	for (const section of collectChildren(children)) {
		if (!isElement(section)) {
			// skip non-element nodes (whitespace, etc.)
		} else if (section.type === "thead") {
			for (const tr of collectChildren(section.props.children)) {
				if (isElement(tr)) {
					for (const th of collectChildren(tr.props.children)) {
						if (isElement(th)) {
							headers.push(extractText(th.props.children));
						}
					}
				}
			}
		} else if (section.type === "tbody") {
			for (const tr of collectChildren(section.props.children)) {
				if (isElement(tr)) {
					const cells: ReactNode[] = [];
					for (const td of collectChildren(tr.props.children)) {
						if (isElement(td)) {
							cells.push(td.props.children);
						}
					}
					rows.push(cells);
				}
			}
		}
	}

	return { headers, rows };
}

function extractText(node: ReactNode): string {
	if (node == null || typeof node === "boolean") {
		return "";
	}
	if (typeof node === "string") {
		return node;
	}
	if (typeof node === "number") {
		return String(node);
	}
	if (Array.isArray(node)) {
		return node.map(extractText).join("");
	}
	if (isElement(node)) {
		return extractText(node.props.children);
	}
	return "";
}

const stackedTableContainerClass = css({
	marginY: "5",
});

const stackedRowClass = css({
	py: "3.5",
	borderBottomWidth: "1px",
	borderBottomColor: "border",
});

const stackedRowHeaderClass = css({
	display: "flex",
	alignItems: "baseline",
	gap: "2.5",
	flexWrap: "wrap",
});

const stackedRowTypeClass = css({
	fontFamily: "mono",
	fontSize: "0.8em",
	color: "muted",
	lineHeight: "1.5",
	"& code": {
		bg: "transparent",
		color: "inherit",
		px: "0",
		py: "0",
		fontSize: "inherit",
	},
});

const stackedRowDescClass = css({
	marginTop: "1",
	fontSize: "sm",
	color: "text",
	lineHeight: "1.6",
	opacity: 0.7,
});

const StackedTable: FC<{ children?: ReactNode }> = ({ children }) => {
	const { headers, rows } = parseTableChildren(children);
	const colCount = headers.length;

	return (
		<div className={stackedTableContainerClass}>
			{rows.map((cells) => {
				const name = cells[0];
				const type = colCount >= 3 ? cells[1] : null;
				const description = colCount >= 3 ? cells[2] : cells[1];
				const rowKey = extractText(name);

				return (
					<div key={rowKey} className={stackedRowClass}>
						<div className={stackedRowHeaderClass}>
							<span>{name}</span>
							{type && <span className={stackedRowTypeClass}>{type}</span>}
						</div>
						{description && (
							<div className={stackedRowDescClass}>{description}</div>
						)}
					</div>
				);
			})}
		</div>
	);
};

const pageLinkClass = (active: boolean) =>
	css({
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
		opacity: active ? 1 : 0.6,
		_hover: { opacity: 1 },
		"&:hover [data-page-link-arrow='true']": {
			opacity: 1,
			transform: "translateY(0)",
		},
		"&:focus-visible [data-page-link-arrow='true']": {
			opacity: 1,
			transform: "translateY(0)",
		},
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

const pageLinkArrowClass = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	fontSize: "sm",
	lineHeight: "1",
	opacity: 0,
	transform: "translateY(2px)",
	transitionProperty: "opacity, transform",
	transitionDuration: "220ms",
});

const Sidebar: FC<SidebarProps> = ({ sitePages, currentPath, toc }) => {
	return (
		<aside className={sidebarClass}>
			<a href="/" className={cx(sidebarBrandClass, sidebarBrandSectionClass)}>
				{siteTitle}
			</a>

			<nav className={pagesNavClass} aria-label="Pages">
				{sitePages.map((p) => {
					const active = p.path === currentPath;
					return (
						<a key={p.path} href={p.path} className={pageLinkClass(active)}>
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
					className={pageLinkClass(false)}>
					<span>GitHub</span>
					<span className={pageLinkAdornmentClass}>
						<span
							className={pageLinkArrowClass}
							data-page-link-arrow="true"
							aria-hidden>
							↗
						</span>
					</span>
				</a>
			</nav>

			{toc.length > 0 && (
				<TocNav toc={toc} className={cx(tocNavClass, css({ mt: "10" }))} />
			)}
		</aside>
	);
};

export const Layout: FC<LayoutProps> = ({
	children,
	sitePages,
	currentPath,
	toc,
}) => {
	return (
		<div className={shellClass}>
			<header className={mobileTopNavClass}>
				<a href="/" className={sidebarBrandClass}>
					{siteTitle}
				</a>
				<a href={githubUrl} className={css({ fontSize: "sm" })}>
					GitHub
				</a>
			</header>

			<div
				className={cx(
					layoutClass,
					currentPath === "/api-reference" && narrowLayoutClass,
				)}>
				<Sidebar sitePages={sitePages} currentPath={currentPath} toc={toc} />
				<main className={contentClass}>
					<article className={cx(articleClass, css(proseStyles))}>
						{children}
					</article>
					<footer className={footerClass}>
						<a
							href={twitterUrl}
							target="_blank"
							rel="noreferrer"
							className={footerLinkClass}>
							Built by @haustle
						</a>
					</footer>
				</main>
			</div>
		</div>
	);
};

export function useMDXComponents() {
	return {
		pre: CodeBlock,
		table: StackedTable,
		NotionCubeLogo,
	};
}
