import Link from "next/link";
import type { FC, ReactNode } from "react";
import { css, cx } from "../styled-system/css";
import { githubUrl, haustleTwitterUrl, siteTitle } from "./config";
import { PageToc } from "./PageToc";
import {
	PAGE_LINK_ARROW_ATTR,
	PAGE_LINK_ARROW_VALUE,
} from "./siteClassNames";
import {
	type SitePage,
	type SitePath,
	sitePaths,
	type TocEntry,
} from "./types";

const narrowMainColumnPaths = new Set<SitePath>(sitePaths);

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
	maxW: "1075px",
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
	gridTemplateColumns: { base: "1fr", lg: "245px minmax(0, 864px)" },
	columnGap: { base: "0", lg: "5.6rem" },
	justifyContent: "center",
	mt: { base: "0", lg: "100px" },
});

const narrowLayoutClass = css({
	gridTemplateColumns: { lg: "245px minmax(0, 648px)" },
});

const sidebarClass = css({
	display: { base: "none", lg: "flex" },
	position: "sticky",
	top: "8",
	flexDirection: "column",
	gap: "5",
	alignSelf: "start",
	bg: "background",
	maxH: "calc(100dvh - var(--spacing-8) - 40px)",
	minH: "0",
	overflow: "hidden",
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
	flexShrink: "0",
});

const pagesNavClass = css({
	display: "flex",
	flexDirection: "column",
	gap: "1",
	bg: { _dark: "bgDark" },
	rounded: "10",
	p: "3",
	flexShrink: "0",
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
	gap: "0",
	minW: "0",
});

const articleBaseClass = css({
	position: "relative",
	zIndex: 1,
	fontSize: "md",
	lineHeight: "1.75",
	color: "text",
});

const siteFooterClass = css({
	mt: "100px",
	mb: "40px",
	fontSize: "sm",
	color: "muted",
	textAlign: "center",
});

const siteFooterCreditLinkClass = css({
	display: "inline-flex",
	alignItems: "center",
	gap: "0.3em",
	color: "inherit",
	textDecoration: "none",
	borderRadius: "2px",
	cursor: "pointer",
	transformOrigin: "center",
	transform: "scale(1)",
	py: "0.5",
	px: "1.5",
	mx: "-1.5",
	my: "-0.5",
	outlineStyle: "solid",
	outlineWidth: "0",
	outlineColor: "transparent",
	outlineOffset: "0",
	transition:
		"color 0.15s ease, background-color 0.2s ease, outline-width 0.22s ease, outline-color 0.22s ease, transform 0.22s cubic-bezier(0.34, 1.45, 0.64, 1)",
	_hover: {
		color: "text",
		backgroundColor: "inlineCodeBg",
		outlineWidth: "5px",
		outlineColor: "inlineCodeBg",
	},
	_active: {
		transform: "scale(0.96)",
		transition:
			"color 0.15s ease, background-color 0.15s ease, outline-width 0.1s ease, outline-color 0.1s ease, transform 0.1s cubic-bezier(0.34, 1.8, 0.64, 1)",
	},
	"@media (prefers-reduced-motion: reduce)": {
		transition: "color 0.15s ease, background-color 0.15s ease, outline-width 0.22s ease, outline-color 0.22s ease",
		_active: {
			transform: "none",
		},
	},
});

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
					className={cx(
						pageLinkBaseClass,
						pageLinkInactiveClass,
						"site-nav-github-link",
					)}>
					<span>GitHub</span>
					<span className={pageLinkAdornmentClass}>
						<span
							{...{ [PAGE_LINK_ARROW_ATTR]: PAGE_LINK_ARROW_VALUE }}
							aria-hidden>
							↗
						</span>
					</span>
				</a>
			</nav>

			{toc.length > 0 && (
				<PageToc toc={toc} className={tocNavOffsetClass} />
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
	const narrowMainColumn =
		currentPath !== "" && narrowMainColumnPaths.has(currentPath);

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
					<article className={articleBaseClass}>{children}</article>
					<footer className={siteFooterClass}>
						<a
							href={haustleTwitterUrl}
							target="_blank"
							rel="noreferrer"
							className={siteFooterCreditLinkClass}>
							<span>Made by</span>
							<span>haustle</span>
						</a>
					</footer>
				</main>
			</div>
		</div>
	);
};
