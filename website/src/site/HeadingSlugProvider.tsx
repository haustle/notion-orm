"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { createHeadingSlugFactory } from "./slugify";

type NextSlug = ReturnType<typeof createHeadingSlugFactory>;

const HeadingSlugContext = createContext<NextSlug | null>(null);

export function HeadingSlugProvider({ children }: { children: ReactNode }) {
	const nextSlug = useMemo(() => createHeadingSlugFactory(), []);
	return (
		<HeadingSlugContext.Provider value={nextSlug}>
			{children}
		</HeadingSlugContext.Provider>
	);
}

export function useHeadingSlug(): NextSlug {
	const fn = useContext(HeadingSlugContext);
	if (fn === null) {
		throw new Error("useHeadingSlug must be used within HeadingSlugProvider");
	}
	return fn;
}
