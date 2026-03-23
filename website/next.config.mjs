import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import createMDX from "@next/mdx";
import webpack from "next/dist/compiled/webpack/webpack-lib.js";
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
	webpack(config) {
		config.ignoreWarnings = [
			...(config.ignoreWarnings ?? []),
			{
				module: /@typescript\/vfs\/dist\/vfs\.esm\.js/,
				message: /Critical dependency: the request of a dependency is an expression/,
			},
		];
		config.plugins.push(
			new webpack.DefinePlugin({
				"process.env.VSCODE_TEXTMATE_DEBUG": JSON.stringify("false"),
			}),
		);
		return config;
	},
};

export default withMDX(nextConfig);
