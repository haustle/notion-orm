/**
 * Register Prism languages used by `content` MDX fences. Core grammars and `prism-react-renderer`
 * share a single `prismjs` instance — import side effects only once, before any `CodeBlock` mount.
 */
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-powershell";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-tsx";
import { registerPrismPlaygroundStyleKeywords } from "./prismPlaygroundStyleKeywords";

/** After all `extend` grammars exist, register `const` / `let` / `var` for JS + TS + TSX. */
registerPrismPlaygroundStyleKeywords(Prism);

export { Prism };
