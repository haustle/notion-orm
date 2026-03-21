"use client";

import dynamic from "next/dynamic";

type AgentationProps = {
	endpoint: string;
};

const DevAgentation =
	process.env.NODE_ENV === "production"
		? null
		: dynamic<AgentationProps>(
				() => import("agentation").then((module) => module.Agentation),
				{
					ssr: false,
					loading: () => null,
				},
			);

export function AgentationDev() {
	if (!DevAgentation) {
		return null;
	}

	return <DevAgentation endpoint="http://localhost:4747" />;
}
