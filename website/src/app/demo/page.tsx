import { SitePageView } from "../../site/SitePageView";
import { getPage, getPageMetadata } from "../../site/site-page-data";
import type { SitePath } from "../../site/types";

const DEMO_PATH: SitePath = "/demo";

export const metadata = getPageMetadata(getPage(DEMO_PATH));

export default function DemoPage() {
	return <SitePageView path={DEMO_PATH} />;
}
