function hasStatus(error: unknown): error is { status: number } {
	return (
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof error.status === "number"
	);
}

export function isNotFoundError(error: unknown): boolean {
	return hasStatus(error) && error.status === 404;
}
