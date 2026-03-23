import type { ComponentType } from "react";

/** Shared SWR key + fetcher so `preload` and `DemoPlaygroundLazy` use the same cache entry. */
export const DEMO_PLAYGROUND_SWR_KEY = "demo-playground-module";

export function fetchDemoPlayground(): Promise<ComponentType> {
	return import("./DemoPlayground").then((mod) => mod.DemoPlayground);
}
