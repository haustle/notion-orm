"use client";

import { useEffect, useRef, useState } from "react";
import { css, cx } from "../styled-system/css";

const VIEWPORT_W = 25;
const VIEWPORT_H = 8;
const VIEWPORT_ROW_START = 8;

const GRID_W = VIEWPORT_W;
const GRID_H = VIEWPORT_H;

const N_PATTERN: readonly string[] = [
	"####...#",
	"#####..#",
	"######.#",
	"####.#.#",
	"####..##",
	"####..##",
	"####..##",
	"####.###",
];

const PHRASE = "notion orm";
const PHRASE_LEN = PHRASE.length;

function dotGrid(): string[][] {
	return Array.from({ length: GRID_H }, () => Array(GRID_W).fill("."));
}

function renderLetterFrame(frame: number, rotationRad: number): string[][] {
	const grid = dotGrid();
	const w = N_PATTERN[0].length;
	const h = N_PATTERN.length;
	const cx = (GRID_W - 1) / 2;
	const cy = (GRID_H - 1) / 2;
	const cos = Math.cos(rotationRad);
	const sin = Math.sin(rotationRad);
	let strokeIdx = 0;

	for (let row = 0; row < h; row++) {
		for (let col = 0; col < w; col++) {
			if (N_PATTERN[row][col] !== "#") {
				continue;
			}
			const lx = col - (w - 1) / 2;
			const ly = row - (h - 1) / 2;
			const px0 = cx + lx;
			const py0 = cy + ly;
			const dx = px0 - cx;
			const dy = py0 - cy;
			const px = cx + dx * cos - dy * sin;
			const py = cy + dx * sin + dy * cos;
			const xi = Math.round(px);
			const yi = Math.round(py);
			if (xi >= 0 && xi < GRID_W && yi >= 0 && yi < GRID_H) {
				const idx = (strokeIdx + frame) % PHRASE_LEN;
				const ch = PHRASE[idx] ?? "?";
				strokeIdx++;
				grid[yi][xi] = ch;
			}
		}
	}
	return grid;
}

function padCubeRowsToViewport(rows: string[][]): string[] {
	const out: string[] = [];
	for (let r = 0; r < VIEWPORT_H; r++) {
		const row = rows[r] ?? Array(VIEWPORT_W).fill(" ");
		const joined = row.join("");
		const trimmed = joined.slice(0, VIEWPORT_W).padEnd(VIEWPORT_W, " ");
		out.push(trimmed);
	}
	return out;
}

function buildMonitorLines(viewportRows: string[][]): string[] {
	const cube = padCubeRowsToViewport(viewportRows);
	const lines = [...MONITOR_LINES];
	for (let r = 0; r < VIEWPORT_H; r++) {
		const rowIdx = VIEWPORT_ROW_START + r;
		const template = lines[rowIdx];
		const left = template.slice(0, 5);
		const right = template.slice(-8);
		lines[rowIdx] = left + cube[r] + right;
	}
	return lines;
}

const MONITOR_LINES: readonly string[] = [
	"+@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@+",
	"=+=================================+.",
	"++.................................+:",
	"++...===========================...+:",
	"++.-=--------------------------- ..+:",
	"++.-*......................... .. ..+:",
	"++.-*......................... .. ..+:",
	"++.-*......................... .. ..+:",
	"++.-*......................... .. ..+:",
	"++.-*......................... .. ..+:",
	"++.-*......................... .. ..+:",
	"++.-*......................... .. ..+:",
	"++.-*......................... .. ..+:",
	"++.-*......................... .. ..+:",
	"++.-*......................... .. ..+:",
	"++.-*........#-.....-+....... .. ..+:",
	"++.-*........+*******-....... .. ..+:",
	"++.-*.........=+++++=........ .. ..+:",
	"++.-*......................... .. ..+:",
	"++.-=......................... .. ..+:",
	"++...                         .....+:",
	"++.................................+:",
	"=+=================================+.",
	"*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*",
	"*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*",
	`%=${":".repeat(29)}=%`,
	"@=.--...............:@@@@@@@@-.=@",
	"@=.::................:::::::::.=@",
	"@=.............................=@",
	"@=:-:..........................=@",
	"@=*#=..........................=@",
	"@==+-..........................=@",
	"@%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%@",
	"#@%%%%%%%%%%%%%%%%@@@@@@@@@@@@@@#",
	"*****************######%%%@@@@*",
	"*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*",
];

const FRAME_COUNT = 48;

const PRECOMPUTED_DISPLAY: readonly string[] = (() => {
	const out: string[] = [];
	for (let f = 0; f < FRAME_COUNT; f++) {
		const nAngle = f * ((Math.PI * 2) / FRAME_COUNT);
		const grid = renderLetterFrame(f, nAngle);
		const lines = buildMonitorLines(grid);
		out.push(lines.join("\n"));
	}
	return out;
})();

const HERO_SPACER_MINH_MOBILE = "50vh";
const HERO_SPACER_MINH = "62vh";

const wrapperClass = css({
	display: "flex",
	justifyContent: "center",
	mb: "4.5rem",
	mt: "2",
});

const fixedHeroStickyClass = css({
	position: "sticky",
	top: 0,
	zIndex: 0,
	pointerEvents: "none",
	overflow: "hidden",
	w: "full",
	minW: "0",
	minH: { base: HERO_SPACER_MINH_MOBILE, lg: HERO_SPACER_MINH },
	display: "flex",
	justifyContent: "center",
	alignItems: "center",
});

const preClass = css({
	fontFamily: "mono",
	fontSize: { base: "xs", md: "sm" },
	lineHeight: { base: "1.18", md: "1.22" },
	fontWeight: "600",
	letterSpacing: "0.01em",
	color: "text",
	opacity: 0.88,
	whiteSpace: "pre",
	overflowX: "auto",
	userSelect: "none",
	m: "0",
	p: "0",
});

const fixedHeroPreClass = css({
	maxW: "100%",
});

interface NotionCubeLogoProps {
	animate?: boolean;
	viewportRows?: readonly string[];
	fixedHero?: boolean;
}

function viewportRowsToGrid(rows: readonly string[]): string[][] {
	return Array.from({ length: GRID_H }, (_, r) =>
		Array.from({ length: GRID_W }, (_, c) => rows[r]?.[c] ?? "."),
	);
}

	export function NotionCubeLogo({
		animate = true,
		viewportRows,
		fixedHero = false,
	}: NotionCubeLogoProps) {
		const preRef = useRef<HTMLPreElement>(null);
		const [reduceMotion, setReduceMotion] = useState(false);
		const shouldAnimate = animate && !reduceMotion;

		useEffect(() => {
			if (!animate) {
				setReduceMotion(true);
				return;
			}
			const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
			const update = () => setReduceMotion(mq.matches);
			update();
			mq.addEventListener("change", update);
			return () => mq.removeEventListener("change", update);
		}, [animate]);

		useEffect(() => {
			if (!shouldAnimate) {
				return;
			}
			let frame = 0;
			const id = window.setInterval(() => {
				frame = (frame + 1) % FRAME_COUNT;
				if (preRef.current) {
					preRef.current.textContent = PRECOMPUTED_DISPLAY[frame] ?? PRECOMPUTED_DISPLAY[0];
				}
			}, 90);
			return () => window.clearInterval(id);
		}, [shouldAnimate]);

		const staticText = viewportRows
			? buildMonitorLines(viewportRowsToGrid(viewportRows)).join("\n")
			: PRECOMPUTED_DISPLAY[0];

		const text =
			!shouldAnimate
				? staticText
				: PRECOMPUTED_DISPLAY[0];

		const pre = (
			<pre ref={preRef} className={cx(preClass, fixedHero && fixedHeroPreClass)}>
				{text}
			</pre>
		);

		if (fixedHero) {
			return (
				<div className={fixedHeroStickyClass} aria-hidden="true">
					{pre}
				</div>
			);
		}

		return (
			<div className={wrapperClass} aria-hidden="true">
				{pre}
			</div>
		);
	}
