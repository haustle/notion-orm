/**
 * Zod-related column metadata types shared between property emitters and schema builders.
 */

/**
 * Column metadata from property emitters before `propName` / `columnName` / `type`
 * are attached. Use `type` to narrow option-literal columns without `in` checks.
 */
export type ZodMetaColumnPayload =
	| {
			type: "plain";
			isRequired: boolean;
	  }
	| {
			type: "optionLiterals";
			isRequired: boolean;
			options: string[];
			propertyValuesIdentifier: string;
	  };
