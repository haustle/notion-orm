import Link from "next/link";
import type { FC, ReactNode } from "react";
import { css, cx } from "../styled-system/css";
import { githubUrl, siteTitle } from "./config";
import { PageToc } from "./PageToc";
import type { SitePage, SitePath, TocEntry } from "./types";

type SiteNavPage = Pick<SitePage, "path" | "title">;

interface LayoutProps {
	children: ReactNode;
	sitePages: SiteNavPage[];
	currentPath: SitePath | "";
	toc: TocEntry[];
}

interface SidebarProps {
	sitePages: SiteNavPage[];
	currentPath: SitePath | "";
	toc: TocEntry[];
}

const shellClass = css({
	maxW: "896px",
	mx: "auto",
	px: { base: "10", md: "8" },
	py: { base: "5", md: "8" },
});

const shellBgClass = css({
	bg: "background",
});

const mobileTopNavClass = css({
	display: { base: "flex", lg: "none" },
	alignItems: "center",
	justifyContent: "space-between",
	gap: "4",
	pb: "4",
	mb: "6",
	bg: "background",
});

const layoutClass = css({
	display: "grid",
	gridTemplateColumns: { base: "1fr", lg: "245px minmax(0, 720px)" },
	columnGap: { base: "0", lg: "5.6rem" },
	justifyContent: "center",
	mt: { base: "0", lg: "100px" },
});

const narrowLayoutClass = css({
	gridTemplateColumns: { lg: "245px minmax(0, 540px)" },
});

const sidebarClass = css({
	display: { base: "none", lg: "flex" },
	position: "sticky",
	top: "8",
	flexDirection: "column",
	gap: "5",
	alignSelf: "start",
	bg: "background",
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

const tocNavOffsetClass = css({
	mt: "10",
});

const mobileGithubLinkClass = css({
	fontSize: "sm",
});

const contentClass = css({
	display: "flex",
	flexDirection: "column",
	gap: "8",
	minW: "0",
});

const articleBaseClass = css({
	position: "relative",
	zIndex: 1,
	fontSize: "md",
	lineHeight: "1.75",
	color: "text",
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

const articleProseClass = css(proseStyles);

const pageLinkBaseClass = css({
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

const pageLinkActiveClass = css({
	opacity: 1,
});

const pageLinkInactiveClass = css({
	opacity: 0.6,
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
			<Link
				href="/"
				className={cx(sidebarBrandClass, sidebarBrandSectionClass)}>
				{siteTitle}
			</Link>

			<nav className={pagesNavClass} aria-label="Pages">
				{sitePages.map((p) => {
					const active = p.path === currentPath;
					return (
						<Link
							key={p.path}
							href={p.path}
							className={cx(
								pageLinkBaseClass,
								active ? pageLinkActiveClass : pageLinkInactiveClass,
							)}>
							<span>{p.title}</span>
							{active && (
								<span className={pageLinkAdornmentClass}>
									<span className={pageLinkDotClass} aria-hidden />
								</span>
							)}
						</Link>
					);
				})}
				<a
					href={githubUrl}
					target="_blank"
					rel="noreferrer"
					className={cx(pageLinkBaseClass, pageLinkInactiveClass)}>
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
				<PageToc toc={toc} className={cx(tocNavClass, tocNavOffsetClass)} />
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
	const isHome = currentPath === "/";
	const narrowMainColumn = isHome || currentPath === "/api-reference";

	return (
		<div className={cx(shellClass, !isHome && shellBgClass)}>
			<header className={mobileTopNavClass}>
				<Link href="/" className={sidebarBrandClass}>
					{siteTitle}
				</Link>
				<a href={githubUrl} className={mobileGithubLinkClass}>
					GitHub
				</a>
			</header>

			<div className={cx(layoutClass, narrowMainColumn && narrowLayoutClass)}>
				<Sidebar sitePages={sitePages} currentPath={currentPath} toc={toc} />
				<main className={contentClass}>
					<article className={cx(articleBaseClass, articleProseClass)}>
						{children}
					</article>
				</main>
			</div>
		</div>
	);
};
