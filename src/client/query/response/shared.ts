export function resolveUserNameOrId(user: unknown): string | null {
	if (!user || typeof user !== "object") {
		return null;
	}

	if (
		"name" in user &&
		typeof user.name === "string" &&
		user.name.length > 0
	) {
		return user.name;
	}

	if ("id" in user && typeof user.id === "string") {
		return user.id;
	}

	return null;
}

export function resolveFilesValue(files: unknown) {
	if (!Array.isArray(files)) {
		return [];
	}

	return files
		.map((file) => {
			if (typeof file.name !== "string") {
				return undefined;
			}

			let url: string | undefined;
			if (file.type === "external") {
				url = file.external?.url;
			} else if (file.type === "file") {
				url = file.file?.url;
			}

			if (typeof url !== "string") {
				return undefined;
			}

			return {
				name: file.name,
				url,
			};
		})
		.filter(
			(value): value is { name: string; url: string } => value !== undefined,
		);
}
