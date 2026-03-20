import { getPage, sitePages } from "../generated/content";
import { Layout } from "./ui";

interface SitePageViewProps {
	path?: string;
}

export function SitePageView({ path = "/" }: SitePageViewProps) {
	const page = getPage(path) ?? getPage("/");
	if (!page) {
		return null;
	}

	const PageComponent = page.component;

	return (
		<Layout sitePages={sitePages} currentPath={path} toc={page.toc}>
			<PageComponent />
		</Layout>
	);
}
