"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { preload } from "swr";
import {
	DEMO_PLAYGROUND_SWR_KEY,
	fetchDemoPlayground,
} from "./demoPlaygroundLoad";

/**
 * After first paint, warm the demo playground chunk and prefetch `/demo` so a later visit feels instant.
 */
export function DemoPlaygroundWarmup() {
	const router = useRouter();

	useEffect(() => {
		let cancelled = false;

		const warm = () => {
			if (cancelled) {
				return;
			}
			preload(DEMO_PLAYGROUND_SWR_KEY, fetchDemoPlayground);
			router.prefetch("/demo");
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
	}, [router]);

	return null;
}
