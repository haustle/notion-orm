import type { MDXComponents } from "mdx/types";
import { mdxComponents } from "./src/site/mdx-components";

export function useMDXComponents(components: MDXComponents): MDXComponents {
	return { ...components, ...mdxComponents };
}
