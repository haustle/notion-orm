import { getPage, getPageMetadata } from "../site/page-data";
import { SitePageView } from "../site/page-view";

export const metadata = getPageMetadata(getPage("/"));

export default function HomePage() {
	return <SitePageView path="/" />;
}
