import type { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import type { Plugin } from "prettier";

let loadPrettier: Promise<{
	formatWithCursor: typeof import("prettier/standalone").formatWithCursor;
	plugins: Plugin[];
}> | null = null;

function loadPrettierForBrowser() {
	if (!loadPrettier) {
		loadPrettier = (async () => {
			const [standalone, estree, typescript] = await Promise.all([
				import("prettier/standalone"),
				import("prettier/plugins/estree"),
				import("prettier/plugins/typescript"),
			]);
			const plugins: Plugin[] = [estree, typescript];
			return {
				formatWithCursor: standalone.formatWithCursor,
				plugins,
			};
		})().catch((err: unknown) => {
			loadPrettier = null;
			throw err;
		});
	}
	return loadPrettier;
}

const formatting = new WeakSet<EditorView>();

/**
 * Replaces the editor document with Prettier output for TypeScript, preserving the caret when possible.
 * Skips if the document was edited after formatting started.
 */
export async function applyPrettierToDemoEditor(view: EditorView): Promise<void> {
	if (formatting.has(view)) {
		return;
	}
	const source = view.state.doc.toString();
	const cursorOffset = view.state.selection.main.head;
	if (source.length === 0) {
		return;
	}
	formatting.add(view);
	try {
		const { formatWithCursor, plugins } = await loadPrettierForBrowser();
		const { formatted, cursorOffset: nextOffset } = await formatWithCursor(
			source,
			{
				cursorOffset,
				parser: "typescript",
				plugins,
			},
		);
		if (view.state.doc.toString() !== source) {
			return;
		}
		const safeOffset = Math.max(
			0,
			Math.min(nextOffset, formatted.length),
		);
		if (formatted === source && safeOffset === cursorOffset) {
			return;
		}
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: formatted },
			selection: EditorSelection.cursor(safeOffset),
			scrollIntoView: true,
		});
	} catch {
		// Unparseable or other Prettier failure: leave the buffer unchanged.
	} finally {
		formatting.delete(view);
	}
}
