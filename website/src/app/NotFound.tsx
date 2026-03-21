import Link from "next/link";
import { sitePages } from "../generated/content";
import { NotionCubeLogo } from "../site/NotionCubeLogo";
import { Layout } from "../site/SiteLayout";
import { css } from "../styled-system/css";

const containerClass = css({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	textAlign: "center",
	gap: "3",
	pt: "6",
});

const messageClass = css({
	m: "0",
	fontFamily: "mono",
	fontSize: { base: "sm", md: "md" },
	fontWeight: "400",
	letterSpacing: "0.01em",
});

const inlineHomeLinkClass = css({
	color: "text",
	textDecoration: "underline",
	textUnderlineOffset: "3px",
});

const CUBE_404_ROWS: readonly string[] = [
	".........................",
	"....###....#####...###...",
	"...##.##..##...##.##.##..",
	"..##..##..##...##.##..##.",
	"..######..##...##.######.",
	"......##..##...##.....##.",
	"......##...#####......##.",
	".........................",
];

export default function NotFound() {
	return (
		<Layout sitePages={sitePages} currentPath="" toc={[]} showFooter={false}>
			<div className={containerClass}>
				<NotionCubeLogo animate={false} viewportRows={CUBE_404_ROWS} />
				<p className={messageClass}>
					Sorry, page not found!{" "}
					<Link href="/" className={inlineHomeLinkClass}>
						Home
					</Link>
				</p>
			</div>
		</Layout>
	);
}
