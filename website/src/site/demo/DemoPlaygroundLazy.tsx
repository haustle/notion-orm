"use client";

import useSWR from "swr";
import { DemoPlaygroundSkeleton } from "./DemoPlaygroundSkeleton";
import {
	DEMO_PLAYGROUND_SWR_KEY,
	fetchDemoPlayground,
} from "./demoPlaygroundLoad";

export function DemoPlaygroundLazy() {
	const { data: Playground } = useSWR(
		DEMO_PLAYGROUND_SWR_KEY,
		fetchDemoPlayground,
		{
			revalidateOnFocus: false,
			revalidateOnReconnect: false,
			shouldRetryOnError: true,
		},
	);

	if (!Playground) {
		return <DemoPlaygroundSkeleton />;
	}

	return <Playground />;
}
