import { insertBracket } from "@codemirror/autocomplete";
import { indentUnit as indentUnitFacet } from "@codemirror/language";
import {
	codePointAt,
	codePointSize,
	EditorSelection,
	type Extension,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * Mirrors @codemirror/autocomplete closeBrackets inputHandler so behavior stays
 * aligned when that package updates (Android composition quirk).
 */
const android =
	typeof navigator === "object" && /Android\b/.test(navigator.userAgent);

const OPEN_BRACE = "{";

type MultilineBraceInputArgs = {
	view: EditorView;
	from: number;
	to: number;
	text: string;
};

/**
 * Same preconditions as the stock closeBrackets input handler, plus `{` only.
 */
function isMultilineBlockBraceInsert(args: MultilineBraceInputArgs): boolean {
	const { view, from, to, text } = args;
	if ((android ? view.composing : view.compositionStarted) || view.state.readOnly) {
		return false;
	}
	const sel = view.state.selection.main;
	if (
		text.length > 2 ||
		(text.length === 2 && codePointSize(codePointAt(text, 0)) === 1) ||
		from !== sel.from ||
		to !== sel.to
	) {
		return false;
	}
	if (!sel.empty) {
		return false;
	}
	if (text !== OPEN_BRACE) {
		return false;
	}
	return insertBracket(view.state, OPEN_BRACE) !== null;
}

function lineLeadingWhitespace(text: string): string {
	const match = /^[\t ]*/.exec(text);
	return match?.[0] ?? "";
}

/**
 * When `{` would get an auto-inserted `}`, insert a multi-line block and put
 * the caret on the empty inner line instead of `{|}` on one line.
 *
 * Register this **before** [`closeBrackets`](https://codemirror.net/docs/ref/#autocomplete.closeBrackets)
 * so this input handler runs first.
 */
export function demoPlaygroundExpandAutoClosedBlockBraces(): Extension {
	return EditorView.inputHandler.of(
		(view, from, to, text, _defaultInsert) => {
			if (
				!isMultilineBlockBraceInsert({
					view,
					from,
					to,
					text,
				})
			) {
				return false;
			}

			const state = view.state;
			const line = state.doc.lineAt(from);
			const base = lineLeadingWhitespace(line.text);
			const unit = state.facet(indentUnitFacet);
			const inner = base + unit;
			const insert = `{\n${inner}\n${base}}`;
			const cursor = from + 1 + inner.length;

			view.dispatch({
				changes: { from, to, insert },
				selection: EditorSelection.cursor(cursor),
				scrollIntoView: true,
				userEvent: "input.type",
			});
			return true;
		},
	);
}
