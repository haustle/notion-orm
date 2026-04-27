import type {
	CompletionContext,
	CompletionResult,
	CompletionSource,
} from "@codemirror/autocomplete";
import type { EditorState } from "@codemirror/state";
import { getAutocompletion, tsFacet } from "@valtown/codemirror-ts";

/**
 * Punctuation where implicit completion is usually noise: end of clauses,
 * and `(` right after picking a call-style completion (menu reopens on the
 * inserted paren). Skip implicit completion here; explicit (Ctrl+Space) still runs.
 */
const IMPLICIT_AUTOCOMPLETE_SUPPRESS_AFTER: ReadonlySet<string> = new Set([
	"(",
	":",
	")",
	"]",
	"}",
]);

function isImplicitlyRightAfterNoisyPunctuation(
	state: EditorState,
	pos: number,
	explicit: boolean,
): boolean {
	if (explicit || pos < 1) {
		return false;
	}
	let charIndex = pos - 1;
	while (charIndex >= 0) {
		const ch = state.doc.sliceString(charIndex, charIndex + 1);
		if (ch === " " || ch === "\t") {
			charIndex -= 1;
			continue;
		}
		return IMPLICIT_AUTOCOMPLETE_SUPPRESS_AFTER.has(ch);
	}
	return false;
}

/**
 * Like `tsAutocomplete()` from `@valtown/codemirror-ts`, but always asks the
 * language service when CodeMirror activates completion. The stock helper
 * skips unless there is a word or `.` before the cursor (or the user pressed
 * Ctrl+Space), which hides completions inside string literals and other
 * positions where VS Code / typical IDEs still surface suggestions.
 */
export function ideLikeTsAutocomplete(): CompletionSource {
	return async (
		context: CompletionContext,
	): Promise<CompletionResult | null> => {
		const config = context.state.facet(tsFacet);
		if (!config) {
			return null;
		}
		if (
			isImplicitlyRightAfterNoisyPunctuation(
				context.state,
				context.pos,
				context.explicit,
			)
		) {
			return null;
		}
		return getAutocompletion({
			...config,
			context: {
				pos: context.pos,
				explicit: true,
			},
		});
	};
}
