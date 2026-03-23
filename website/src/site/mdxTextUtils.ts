import {
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react";

export function isElement(
	node: ReactNode,
): node is ReactElement<{ children?: ReactNode }> {
	return isValidElement<{ children?: ReactNode }>(node);
}

export function extractText(node: ReactNode): string {
	if (node == null || typeof node === "boolean") {
		return "";
	}
	if (typeof node === "string") {
		return node;
	}
	if (typeof node === "number") {
		return String(node);
	}
	if (Array.isArray(node)) {
		return node.map(extractText).join("");
	}
	if (isElement(node)) {
		return extractText(node.props.children);
	}
	return "";
}
