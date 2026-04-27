import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../styled-system/styles.css";
import "../site/demo/demoCursorHint.css";
import "../site/demo/demoPlaygroundResetButton.css";
import "../site/siteNavGithubLink.css";
import { AgentationDev } from "../site/AgentationDev";
import {
	siteDefaultDescription,
	siteSocialMetadata,
	siteTitle,
	siteUrlForMetadata,
} from "../site/config";
import { DemoPlaygroundWarmup } from "../site/demo/DemoPlaygroundWarmup";
import {
	SITE_COLOR_MODE_ATTR,
	SITE_COLOR_MODE_DARK,
	SITE_COLOR_MODE_LIGHT,
} from "../site/siteClassNames";
import { css } from "../styled-system/css";

const appRootClass = css({
	position: "relative",
	zIndex: 1,
	minH: "100%",
});

export const metadata: Metadata = {
	metadataBase: new URL(siteUrlForMetadata()),
	title: {
		default: siteTitle,
		template: `%s · ${siteTitle}`,
	},
	description: siteDefaultDescription,
	...siteSocialMetadata({
		openGraphTitle: siteTitle,
		openGraphDescription: siteDefaultDescription,
	}),
};

interface RootLayoutProps {
	children: ReactNode;
}

const themeInitScript = `(function(){var d=document.documentElement;var m=window.matchMedia("(prefers-color-scheme: dark)");var apply=function(e){d.setAttribute("${SITE_COLOR_MODE_ATTR}",e.matches?"${SITE_COLOR_MODE_DARK}":"${SITE_COLOR_MODE_LIGHT}")};apply(m);if(typeof m.addEventListener==="function"){m.addEventListener("change",apply)}else if(typeof m.addListener==="function"){m.addListener(apply)}})();`;

export default function RootLayout({ children }: RootLayoutProps) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: theme init runs before paint to prevent flash
					dangerouslySetInnerHTML={{ __html: themeInitScript }}
					suppressHydrationWarning
				/>
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin=""
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
					rel="stylesheet"
				/>
				{/* Prefetch static /demo for idle navigation without a client `useRouter()` subscription in DemoPlaygroundWarmup */}
				<link rel="prefetch" href="/demo" />
			</head>
			<body>
				<div className={appRootClass}>{children}</div>
				<DemoPlaygroundWarmup />
				<AgentationDev />
			</body>
		</html>
	);
}
