import { getPage, getPageMetadata } from "../../site/site-page-data";
import { SitePageView } from "../../site/SitePageView";

export const metadata = getPageMetadata(getPage("/api-reference"));

export default function ApiReferencePage() {
	return <SitePageView path="/api-reference" />;
}
