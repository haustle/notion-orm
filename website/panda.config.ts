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
			fontWeight: "400",
			fontDisplay: "swap",
			src: "url('/fonts/BerkeleyMono-Regular.woff2') format('woff2')",
		},
		"html, body": {
			minHeight: "100%",
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
	},
});
