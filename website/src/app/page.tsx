import { getPage, getPageMetadata } from "../site/site-page-data";
import { SitePageView } from "../site/SitePageView";

export const metadata = getPageMetadata(getPage("/"));

export default function HomePage() {
	return <SitePageView path="/" />;
}
