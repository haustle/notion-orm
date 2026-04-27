import { SITE_TOC_HEADING_CLICK_FLASH_CLASS } from "./siteClassNames";

/** Must match `tocHeadingClickFlash` duration in `panda.config.ts` */
const TOC_HEADING_FLASH_MS = 800;
const FLASH_CLEAR_SAFETY_MS = 100;

/**
 * Plays a one-shot highlight on the in-page heading when navigating from the sidebar TOC
 * (light blue wash + ring 0 → 4px → 0, then fade). No-op for `prefers-reduced-motion`.
 */
export function playTocHeadingClickFlash(headingId: string): void {
	if (typeof document === "undefined" || !headingId) {
		return;
	}
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		return;
	}

	const el = document.getElementById(headingId);
	if (!el) {
		return;
	}

	const clear = () => {
		/** Two frames: let `animation`/`forwards` finish painting, then re-enable `transition` on children. */
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				el.classList.remove(SITE_TOC_HEADING_CLICK_FLASH_CLASS);
			});
		});
	};

	el.classList.remove(SITE_TOC_HEADING_CLICK_FLASH_CLASS);
	// Re-trigger the same keyframes if the user clicks the same TOC item again.
	void el.getBoundingClientRect();
	el.classList.add(SITE_TOC_HEADING_CLICK_FLASH_CLASS);

	/** `animationend` is primary; timeout clears the class if the event does not run (bfcache, browsers). */
	const tid = window.setTimeout(() => {
		clear();
	}, TOC_HEADING_FLASH_MS + FLASH_CLEAR_SAFETY_MS);

	const onEnd = () => {
		window.clearTimeout(tid);
		clear();
	};

	el.addEventListener("animationend", onEnd, { once: true });
}
