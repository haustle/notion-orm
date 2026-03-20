import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig = {
	turbopack: {
		root: workspaceRoot,
	},
};

export default nextConfig;
