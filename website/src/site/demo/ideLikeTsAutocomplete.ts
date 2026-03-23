import type {
	CompletionContext,
	CompletionResult,
	CompletionSource,
} from "@codemirror/autocomplete";
import { getAutocompletion, tsFacet } from "@valtown/codemirror-ts";

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
		return getAutocompletion({
			...config,
			context: {
				pos: context.pos,
				explicit: true,
			},
		});
	};
}
