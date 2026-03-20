import { getPage, getPageMetadata } from "../../site/page-data";
import { SitePageView } from "../../site/page-view";

export const metadata = getPageMetadata(getPage("/api-reference"));

export default function ApiReferencePage() {
	return <SitePageView path="/api-reference" />;
}
