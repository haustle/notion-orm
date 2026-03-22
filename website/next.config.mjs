import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";

const workspaceRoot = dirname(fileURLToPath(import.meta.url));

const withMDX = createMDX({
	options: {
		remarkPlugins: [remarkGfm],
	},
});

const nextConfig = {
	pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
	turbopack: {
		root: workspaceRoot,
	},
};

export default withMDX(nextConfig);
