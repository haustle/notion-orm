import type { Metadata } from "next";

export const siteTitle = "Notion ORM";
export const githubUrl = "https://github.com/Haustle/notion-orm";
/** Opens X follow flow for @haustle (used in site credit link) */
export const haustleTwitterUrl =
	"https://x.com/intent/follow?screen_name=haustle";

/** Default `description` / OG description for the root layout and pages without a content description. */
export const siteDefaultDescription =
	"Typed Notion workflows for databases and agents.";

/**
 * Resolves the site origin for `metadataBase` and absolute Open Graph URLs.
 * Prefer `NEXT_PUBLIC_SITE_URL` in env when the public hostname differs from Vercel’s deployment URL.
 */
export function siteUrlForMetadata(): string {
	const fromPublic = process.env.NEXT_PUBLIC_SITE_URL;
	if (fromPublic) {
		return fromPublic.replace(/\/$/, "");
	}
	const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
	if (production) {
		return production.startsWith("http")
			? production.replace(/\/$/, "")
			: `https://${production}`;
	}
	const vercel = process.env.VERCEL_URL;
	if (vercel) {
		return `https://${vercel}`;
	}
	return "http://localhost:8788";
}

/** Default Open Graph / Twitter image (served from `public/orm-og.png`). */
const siteOgImage = {
	url: "/orm-og.png",
	width: 1200,
	height: 630,
	alt: siteTitle,
} as const;

/** Matches the root `metadata.title` template `%s · ${siteTitle}`. */
export function pageDocumentTitle(pageTitle: string): string {
	return `${pageTitle} · ${siteTitle}`;
}

interface SiteSocialMetadataArgs {
	openGraphTitle: string;
	openGraphDescription: string;
}

/** Shared Open Graph + Twitter card fields for the root layout and `getPageMetadata`. */
export function siteSocialMetadata(
	args: SiteSocialMetadataArgs,
): Pick<Metadata, "openGraph" | "twitter"> {
	return {
		openGraph: {
			title: args.openGraphTitle,
			description: args.openGraphDescription,
			type: "website",
			siteName: siteTitle,
			images: [siteOgImage],
		},
		twitter: {
			card: "summary_large_image",
		},
	};
}
