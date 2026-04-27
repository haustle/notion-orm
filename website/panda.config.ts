import { defineConfig } from "@pandacss/dev";
import { siteColorModePandaConditions } from "./src/site/siteClassNames";

// biome-ignore lint/style/noDefaultExport: we need to export the default config
export default defineConfig({
	outdir: "src/styled-system",
	jsxFramework: "react",
	preflight: true,
	include: ["./src/**/*.{ts,tsx}", "./src/generated/**/*.{ts,tsx}"],
	exclude: [
		"./node_modules/**/*",
		"./src/styled-system/**/*",
		"./src/generated/styles.ts",
	],
	conditions: {
		extend: {
			dark: siteColorModePandaConditions.dark,
			light: siteColorModePandaConditions.light,
		},
	},
	theme: {
		extend: {
			tokens: {
				/** 2.5×1.5rem — between preset `12` and `14`, used for article heading scroll margin. */
				spacing: {
					15: { value: "3.75rem" },
				},
				colors: {
					// Light mode primitives
					bgLight: { value: "#ffffff" },
					surfaceLight: { value: "#ffffff" },
					borderLight: { value: "#e5e7eb" },
					textLight: { value: "#111827" },
					mutedLight: { value: "#6b7280" },
					accentLight: { value: "#10b981" },
					accentSoftLight: { value: "#ecfdf5" },
					codeBgLight: { value: "#f9fafb" },
					codeBorderLight: { value: "#e5e7eb" },
					codeTextLight: { value: "#374151" },
					inlineCodeBgLight: { value: "#f3f4f6" },
					inlineCodeTextLight: { value: "#374151" },
					// Dark mode primitives (minimalist, low-contrast)
					bgDark: { value: "#1a1a1a" },
					surfaceDark: { value: "#1a1a1a" },
					borderDark: { value: "#333333" },
					textDark: { value: "#d1d1d1" },
					mutedDark: { value: "#757575" },
					codeBgDark: { value: "#242424" },
					codeBorderDark: { value: "#333333" },
					codeTextDark: { value: "#d1d1d1" },
					inlineCodeBgDark: { value: "#242424" },
					inlineCodeTextDark: { value: "#d1d1d1" },
				},
				fonts: {
					body: {
						value:
							'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
					},
					/** Berkeley Mono — `@font-face` is in `globalCss` below. */
					mono: {
						value: '"Berkeley Mono", ui-monospace, monospace',
					},
				},
				shadows: {
					subtle: { value: "0 1px 2px rgba(32, 29, 24, 0.04)" },
					subtleDark: { value: "0 1px 2px rgba(0, 0, 0, 0.3)" },
				},
			},
			keyframes: {
				/** One-shot: TOC link click only — `website/src/site/tocHeadingClickFlash.ts` */
				/**
				 * Ring = `box-shadow` spread. Intro: **2px** transparent → up to **4px**; exit: **4 → 3 → 2 → 1 → 0 → -2px**
				 * (negative spread pulls inward), then background fades. Colors: `--site-toc-flash-channels` in `globalCss`.
				 */
				tocHeadingClickFlash: {
					"0%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0)",
						boxShadow: "0 0 0 2px rgb(var(--site-toc-flash-channels) / 0)",
					},
					"4%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0.2)",
						boxShadow: "0 0 0 2px rgb(var(--site-toc-flash-channels) / 0.35)",
					},
					"10%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0.55)",
						boxShadow: "0 0 0 2px rgb(var(--site-toc-flash-channels) / 0.55)",
					},
					"16%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0.55)",
						boxShadow: "0 0 0 3px rgb(var(--site-toc-flash-channels) / 0.55)",
					},
					"24%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0.55)",
						boxShadow: "0 0 0 4px rgb(var(--site-toc-flash-channels) / 0.55)",
					},
					"32%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0.55)",
						boxShadow: "0 0 0 3px rgb(var(--site-toc-flash-channels) / 0.55)",
					},
					"38%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0.55)",
						boxShadow: "0 0 0 2px rgb(var(--site-toc-flash-channels) / 0.55)",
					},
					"44%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0.55)",
						boxShadow: "0 0 0 1px rgb(var(--site-toc-flash-channels) / 0.45)",
					},
					"50%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0.55)",
						boxShadow: "0 0 0 0 rgb(var(--site-toc-flash-channels) / 0)",
					},
					"54%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0.55)",
						boxShadow: "0 0 0 -2px rgb(var(--site-toc-flash-channels) / 0)",
					},
					"55%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0.4)",
						boxShadow: "0 0 0 -2px rgb(var(--site-toc-flash-channels) / 0)",
					},
					"70%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0.18)",
						boxShadow: "0 0 0 -2px rgb(var(--site-toc-flash-channels) / 0)",
					},
					"88%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0.04)",
						boxShadow: "0 0 0 -2px rgb(var(--site-toc-flash-channels) / 0)",
					},
					"100%": {
						backgroundColor: "rgb(var(--site-toc-flash-channels) / 0)",
						/** Match unstyled `h1–h4` (no `box-shadow`) so removing the class does not pop. */
						boxShadow: "none",
					},
				},
			},
		},
		semanticTokens: {
			colors: {
				background: {
					value: { base: "{colors.bgLight}", _dark: "{colors.bgDark}" },
				},
				surface: {
					value: {
						base: "{colors.surfaceLight}",
						_dark: "{colors.surfaceDark}",
					},
				},
				border: {
					value: { base: "{colors.borderLight}", _dark: "{colors.borderDark}" },
				},
				text: {
					value: { base: "{colors.textLight}", _dark: "{colors.textDark}" },
				},
				muted: {
					value: { base: "{colors.mutedLight}", _dark: "{colors.mutedDark}" },
				},
				accent: {
					value: {
						base: "{colors.accentLight}",
						_dark: "{colors.accentLight}",
					},
				},
				accentSoft: {
					value: { base: "{colors.accentSoftLight}", _dark: "#052e16" },
				},
				codeBg: {
					value: { base: "{colors.codeBgLight}", _dark: "{colors.codeBgDark}" },
				},
				codeBorder: {
					value: {
						base: "{colors.codeBorderLight}",
						_dark: "{colors.codeBorderDark}",
					},
				},
				codeText: {
					value: {
						base: "{colors.codeTextLight}",
						_dark: "{colors.codeTextDark}",
					},
				},
				inlineCodeBg: {
					value: {
						base: "{colors.inlineCodeBgLight}",
						_dark: "{colors.inlineCodeBgDark}",
					},
				},
				inlineCodeText: {
					value: {
						base: "{colors.inlineCodeTextLight}",
						_dark: "{colors.inlineCodeTextDark}",
					},
				},
			},
		},
	},
	globalCss: {
		"@font-face": {
			fontFamily: '"Berkeley Mono"',
			fontStyle: "normal",
			fontWeight: "100 900",
			fontDisplay: "swap",
			src: "url('/fonts/BerkeleyMonoVariable.woff2') format('woff2')",
		},
		"html, body": {
			minHeight: "100%",
		},
		/** TOC flash: light `#93d4ff`; dark keeps `rgb(37 99 235)` for contrast. */
		html: {
			"--site-toc-flash-channels": "147 212 255",
		},
		"html[data-color-mode=dark]": {
			"--site-toc-flash-channels": "37 99 235",
		},
		body: {
			margin: "0",
			bg: "background",
			color: "text",
			fontFamily: "body",
		},
		a: {
			color: "text",
			textDecoration: "none",
		},
		"code, pre": {
			fontFamily: "mono",
		},
		/** `SITE_TOC_HEADING_CLICK_FLASH_CLASS` — must be a single class for DOM `classList` */
		".site-toc-heading-click-flash": {
			backgroundColor: "transparent",
			width: "fit-content",
			maxWidth: "100%",
			borderRadius: "4px",
			/** `forwards` only — `both` can leave keyframed `background` feeling sticky vs inherited heading styles. */
			animation:
				"tocHeadingClickFlash 800ms cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
		},
	},
});
