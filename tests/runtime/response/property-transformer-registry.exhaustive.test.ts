import { describe, expect, test } from "bun:test";
import { simplifiedPropertyValueTransformers } from "../../../src/client/database/query/response";
import { SUPPORTED_PROPERTY_TYPES } from "../../../src/client/database/types";
import { objectEntries } from "../../../src/typeUtils";

describe("response transformer registry coverage", () => {
	// Checks every supported property type has a registered transformer.
	test("includes every supported property type", () => {
		expect(Object.keys(simplifiedPropertyValueTransformers).sort()).toEqual(
			objectEntries(SUPPORTED_PROPERTY_TYPES)
				.filter(([, isSupported]) => isSupported)
				.map(([propertyType]) => propertyType)
				.sort(),
		);
	});
});
