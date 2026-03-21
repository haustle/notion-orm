import { getPage, sitePages } from "../generated/content";
import { Layout } from "./SiteLayout";
import type { SitePath } from "./types";

interface SitePageViewProps {
	path?: SitePath;
}

export async function SitePageView({ path = "/" }: SitePageViewProps) {
	const page = getPage(path) ?? getPage("/");
	if (!page) {
		return null;
	}

	const loadedModule = page.loadComponent
		? await page.loadComponent()
		: undefined;
	const PageComponent = page.component ?? loadedModule?.default;
	if (!PageComponent) {
		return null;
	}

	return (
		<Layout sitePages={sitePages} currentPath={path} toc={page.toc}>
			<PageComponent />
		</Layout>
	);
}
