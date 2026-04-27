"use client";

import { useEffect } from "react";
import { preload } from "swr";
import {
	DEMO_PLAYGROUND_SWR_KEY,
	fetchDemoPlayground,
} from "./demoPlaygroundLoad";

/**
 * After first paint, warm the demo playground chunk. Route JS/CSS for `/demo` is prefetched from
 * `<link rel="prefetch" href="/demo" />` in the root layout so this module does not call
 * `useRouter()` (avoids re-subscribing the warmup subtree to App Router state on every URL tick).
 */
export function DemoPlaygroundWarmup() {
	useEffect(() => {
		let cancelled = false;

		const warm = () => {
			if (cancelled) {
				return;
			}
			preload(DEMO_PLAYGROUND_SWR_KEY, fetchDemoPlayground);
		};

		if (typeof window.requestIdleCallback === "function") {
			const idleId = window.requestIdleCallback(warm, { timeout: 4000 });
			return () => {
				cancelled = true;
				window.cancelIdleCallback(idleId);
			};
		}

		const timeoutId = window.setTimeout(warm, 1500);
		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
		};
	}, []);

	return null;
}
