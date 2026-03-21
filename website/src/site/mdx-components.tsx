import {
	Children,
	type FC,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";
import { css, cx } from "../styled-system/css";
import { NotionCubeLogo } from "./NotionCubeLogo";

interface CodeBlockProps {
	children?: ReactNode;
}

interface CodeBlockData {
	code: string;
	language: string | null;
	fileLabel: string | null;
	caption: string | null;
}

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
	borderTopRadius: "16px",
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
});

const codeBlockPreClass = css({
	m: "0",
	px: "6",
	py: "5",
	overflowX: "auto",
	fontFamily: "mono",
	fontSize: "sm",
	lineHeight: "1.75",
	color: "text",
});

const codeBlockCaptionClass = css({
	mt: "2.5",
	px: "1",
	fontSize: "sm",
	color: "muted",
});

const CodeBlock: FC<CodeBlockProps> = ({ children }) => {
	const blockData = getCodeBlockData(children);

	if (!blockData) {
		return <pre className={codeBlockFallbackPreClass}>{children}</pre>;
	}

	const hasCaption = blockData.caption !== null;

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
					<span>{blockData.fileLabel ?? "Code"}</span>
					<span>{getLanguageLabel(blockData.language)}</span>
				</div>
				<pre className={codeBlockPreClass}>
					<code>{blockData.code}</code>
				</pre>
			</div>
			{hasCaption && (
				<p className={codeBlockCaptionClass}>{blockData.caption}</p>
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
			continue;
		}
		if (section.type === "thead") {
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

const mdxComponents = {
	pre: CodeBlock,
	table: StackedTable,
	NotionCubeLogo,
};

export function useMDXComponents() {
	return mdxComponents;
}
