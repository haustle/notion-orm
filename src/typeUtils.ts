type Entries<T> = {
    [K in keyof T]-?: [K, T[K]];
}[keyof T][];
0

// Pulled this helper function from StackOverflow
// https://stackoverflow.com/questions/60141960/typescript-key-value-relation-preserving-object-entries-type
export function objectEntries<T extends object>(obj: T): Entries<T> {
    return Object.entries(obj) as Entries<T>;
}
