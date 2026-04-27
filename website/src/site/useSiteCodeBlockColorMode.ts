import { useLayoutEffect, useState } from "react";
import { SITE_COLOR_MODE_ATTR, SITE_COLOR_MODE_DARK } from "./siteClassNames";

/**
 * Client-only color signal: `ready: false` until `data-color-mode` is read on `<html>`
 * (see `src/app/layout.tsx`). Callers that need a boolean (e.g. Prism) should use
 * {@link isSiteCodeDarkForPrism} instead of reading `isDark` while `ready` is false.
 */
type SiteCodeBlockColorMode =
	| { ready: false }
	| { ready: true; isDark: boolean };

function isSiteCodeBlockColorModeReady(
	mode: SiteCodeBlockColorMode,
): mode is { ready: true; isDark: boolean } {
	return mode.ready;
}

/**
 * Dark mode for syntax themes (Prism, etc.) before the client has attached is unknown;
 * we default to **light** until `ready` so the first paint matches SSR and stays consistent
 * with `getSiteCodeBlockPrismTheme(false)`.
 */
export function isSiteCodeDarkForPrism(mode: SiteCodeBlockColorMode): boolean {
	if (!isSiteCodeBlockColorModeReady(mode)) {
		return false;
	}
	return mode.isDark;
}

/**
 * Read `data-color-mode` on `<html>` (see `src/app/layout.tsx` theme init script).
 * `useLayoutEffect` + `MutationObserver` align syntax **theme** with the real attribute
 * after attach; {@link isSiteCodeDarkForPrism} defaults to light until `ready` so Prism
 * token colors stay consistent with SSR on first paint. MDX `Highlight` does not wait
 * for `ready`—only the theme passed to `getSiteCodeBlockPrismTheme` does.
 */
export function useSiteCodeBlockColorMode(): SiteCodeBlockColorMode {
	const [s, setS] = useState<SiteCodeBlockColorMode>({ ready: false });

	useLayoutEffect(() => {
		const read = () => {
			setS({
				ready: true,
				isDark:
					document.documentElement.getAttribute(SITE_COLOR_MODE_ATTR) ===
					SITE_COLOR_MODE_DARK,
			});
		};
		read();
		const o = new MutationObserver(read);
		o.observe(document.documentElement, {
			attributes: true,
			attributeFilter: [SITE_COLOR_MODE_ATTR],
		});
		return () => o.disconnect();
	}, []);

	return s;
}
