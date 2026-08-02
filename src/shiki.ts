import {
	transformerNotationDiff,
	transformerNotationHighlight,
	transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { createHighlighter, type Highlighter } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { transformerFileName } from "@/utils/transformers/fileName";

/**
 * One Shiki configuration for the whole site. `defaultColor: false` is what
 * emits the `--shiki-light` / `--shiki-dark` CSS variables that
 * src/styles/typography.css targets; changing it breaks dark mode for code.
 */
export const SHIKI_THEMES = { light: "min-light", dark: "night-owl" } as const;

export const SHIKI_TRANSFORMERS = [
	transformerFileName({ style: "v2", hideDot: false }),
	transformerNotationHighlight(),
	transformerNotationWordHighlight(),
	transformerNotationDiff({ matchAlgorithm: "v3" }),
];

/** Languages used across posts, plus a few common ones. */
const LANGS = [
	"bash",
	"shell",
	"sh",
	"zsh",
	"ini",
	"json",
	"jsonc",
	"yaml",
	"typescript",
	"ts",
	"javascript",
	"js",
	"xml",
	"csharp",
	"diff",
	"powershell",
	"astro",
	"css",
	"html",
];

/**
 * Engine: the JavaScript regex engine, NOT the default Oniguruma WASM one. This
 * module also runs inside Astro's container for the on-demand /tina-island
 * route — a workerd sandbox that forbids `WebAssembly.instantiate`, where the
 * WASM engine throws and takes visual editing down with it.
 */
let highlighterPromise: Promise<Highlighter> | undefined;

export function getHighlighter(): Promise<Highlighter> {
	highlighterPromise ??= createHighlighter({
		themes: [SHIKI_THEMES.light, SHIKI_THEMES.dark],
		langs: LANGS,
		engine: createJavaScriptRegexEngine(),
	});
	return highlighterPromise;
}
