"use client";

import type { AgentationProps } from "agentation";
import dynamic from "next/dynamic";

/** Must match `agentation-mcp server` HTTP port (default 4747). */
const agentationHttpEndpoint =
	process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT ?? "http://localhost:4747";

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

	return <DevAgentation endpoint={agentationHttpEndpoint} />;
}
