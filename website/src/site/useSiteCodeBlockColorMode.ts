import { useLayoutEffect, useState } from "react";
import { SITE_COLOR_MODE_ATTR, SITE_COLOR_MODE_DARK } from "./siteClassNames";

type ColorState = { ready: false } | { ready: true; isDark: boolean };

/**
 * Read `data-color-mode` on `<html>` (see `src/app/layout.tsx` theme init script).
 * Defers to `useLayoutEffect` + `MutationObserver` so the first client paint matches
 * SSR (plain code block) and no hydration flash for theme, then we swap in Prism highlights.
 */
export function useSiteCodeBlockColorMode(): ColorState {
	const [s, setS] = useState<ColorState>({ ready: false });

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
