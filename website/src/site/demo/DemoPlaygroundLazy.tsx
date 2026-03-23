"use client";

import dynamic from "next/dynamic";

const LazyPlayground = dynamic(
	() =>
		import("./DemoPlayground").then((mod) => ({
			default: mod.DemoPlayground,
		})),
	{
		ssr: false,
		loading: () => null,
	},
);

export function DemoPlaygroundLazy() {
	return <LazyPlayground />;
}
