import { Children, type FC, type ReactNode } from "react";
import { css, cx } from "../styled-system/css";
import { CodeBlock } from "./CodeBlock";
import { DemoEditorShortcutsCallout } from "./demo/DemoEditorShortcutsCallout";
import { DemoPlaygroundLazy } from "./demo/DemoPlaygroundLazy";
import {
	MdxHeading1,
	MdxHeading2,
	MdxHeading3,
	MdxHeading4,
} from "./mdxHeading";
import { docsArticleProseClass } from "./docsArticleProse";
import { extractText, isElement } from "./mdxTextUtils";
import { NotionCubeLogo } from "./NotionCubeLogo";

function collectChildren(children: ReactNode): ReactNode[] {
	return Children.toArray(children);
}

interface ParsedTableData {
	headers: string[];
	rows: ReactNode[][];
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

const stackedTableContainerClass = css({
	marginY: "5",
});

const stackedRowClass = css({
	py: "3.5",
	borderBottomWidth: "1px",
	borderBottomColor: "border",
});

const stackedRowLastClass = css({
	borderBottomWidth: "0",
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
			{rows.map((cells, rowIndex) => {
				const name = cells[0];
				const type = colCount >= 3 ? cells[1] : null;
				const description = colCount >= 3 ? cells[2] : cells[1];
				const rowKey = extractText(name);
				const isLastRow = rowIndex === rows.length - 1;

				return (
					<div
						key={rowKey}
						className={cx(stackedRowClass, isLastRow && stackedRowLastClass)}>
						<div className={stackedRowHeaderClass}>
							<span>{name}</span>
							{type && (
								<span
									className={stackedRowTypeClass}
									data-docs-prose-plain-code>
									{type}
								</span>
							)}
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

const docsProseClass = css({
	bg: "background",
	position: "relative",
	zIndex: 1,
	minW: "0",
	pt: "40px",
});

const docsProseFlushTopClass = css({
	pt: "0",
});

const DocsProse: FC<{
	children?: ReactNode;
	flushTop?: boolean;
}> = ({ children, flushTop }) => (
	<div
		className={cx(
			docsProseClass,
			docsArticleProseClass,
			flushTop && docsProseFlushTopClass,
		)}>
		{children}
	</div>
);

export const mdxComponents = {
	h1: MdxHeading1,
	h2: MdxHeading2,
	h3: MdxHeading3,
	h4: MdxHeading4,
	pre: CodeBlock,
	table: StackedTable,
	NotionCubeLogo,
	DocsProse,
	DemoEditorShortcutsCallout,
	DemoPlayground: DemoPlaygroundLazy,
};
