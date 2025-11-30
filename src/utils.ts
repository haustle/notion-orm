// Utility functions for runtime use

// for a type's property name
export function camelize(str: string) {
	// First, strip out all non-alphanumeric characters except spaces
	const cleaned = str.replace(/[^a-zA-Z0-9\s]/g, '');
	
	// Then apply camelCase transformation
	return cleaned.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function (match, index) {
		if (+match === 0) return ""; // or if (/\s+/.test(match)) for white spaces
		return index === 0 ? match.toLowerCase() : match.toUpperCase();
	});
}
