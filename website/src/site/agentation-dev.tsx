"use client";

import { Agentation } from "agentation";

export function AgentationDev() {
	if (process.env.NODE_ENV === "production") {
		return null;
	}
	return <Agentation endpoint="http://localhost:4747" />;
}
