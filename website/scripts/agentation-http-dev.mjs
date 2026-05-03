/**
 * Dev-only HTTP bridge for the Agentation toolbar (browser → :4747).
 * Run with **Node** so `better-sqlite3` works (Bun falls back to in-memory store).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const portSchema = z.coerce.number().int().min(1).max(65535);
const rawPort = process.env.AGENTATION_HTTP_PORT ?? "4747";
const parsedPort = portSchema.safeParse(rawPort);
if (!parsedPort.success) {
	console.error(
		`[agentation-http-dev] Invalid AGENTATION_HTTP_PORT: ${rawPort} (${parsedPort.error.message})`,
	);
	process.exit(1);
}
const port = parsedPort.data;

/** Default matches `AgentationDev` / README when env is unset. */
const defaultPublicEndpoint = "http://localhost:4747";
const publicEndpoint =
	process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT ?? defaultPublicEndpoint;
try {
	const url = new URL(publicEndpoint);
	const publicPort =
		url.port !== ""
			? Number(url.port)
			: url.protocol === "https:"
				? 443
				: 80;
	if (publicPort !== port) {
		console.warn(
			`[agentation-http-dev] Port mismatch: server listens on ${port} (AGENTATION_HTTP_PORT) but NEXT_PUBLIC_AGENTATION_ENDPOINT is ${publicEndpoint}. Point both at the same port or the toolbar will miss the HTTP API.`,
		);
	}
} catch {
	console.warn(
		`[agentation-http-dev] Invalid NEXT_PUBLIC_AGENTATION_ENDPOINT: ${JSON.stringify(publicEndpoint)}`,
	);
}

const indexPath = path.join(
	__dirname,
	"..",
	"node_modules",
	"agentation-mcp",
	"dist",
	"index.mjs",
);
const { startHttpServer } = await import(pathToFileURL(indexPath).href);
startHttpServer(port);
