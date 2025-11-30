export function camelize(str: string) {
  // First, strip out all non-alphanumeric characters except spaces
  const cleaned = str.replace(/[^a-zA-Z0-9\s]/g, "");

  // Then apply camelCase transformation
  return cleaned.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function (match, index) {
    if (+match === 0) return ""; // or if (/\s+/.test(match)) for white spaces
    return index === 0 ? match.toLowerCase() : match.toUpperCase();
  });
}

type Entries<T> = {
  [K in keyof T]-?: [K, T[K]];
}[keyof T][];
0;

// Pulled this helper function from StackOverflow
// https://stackoverflow.com/questions/60141960/typescript-key-value-relation-preserving-object-entries-type
export function objectEntries<T extends object>(obj: T): Entries<T> {
  return Object.entries(obj) as Entries<T>;
}
