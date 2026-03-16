import type { QueryDataSourceResponse } from "@notionhq/client/build/src/api-endpoints";
import type {
  apiFilterType,
  apiSingleFilter,
  QueryFilter,
  SingleFilter,
  SupportedNotionColumnType,
} from "./types";
import type { camelPropertyNameToNameAndTypeMapType } from "./client";
import { camelize } from "../helpers";

/**
 * Transforms Notion API query response into simplified format
 */
export function buildQueryResponse<DatabaseSchemaType extends Record<string, any>>(
  res: QueryDataSourceResponse,
  camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType,
  validateSchema: (result: Partial<DatabaseSchemaType>) => void,
  meta?: { $icon?: true; $cover?: true }
): (Partial<DatabaseSchemaType> & { id: string })[] {
  const results: Array<Partial<DatabaseSchemaType>> = res.results
    .map((result, index) => {
      if (result.object === "page" && !("properties" in result)) {
        // biome-ignore lint/suspicious/noConsole: surfaced for debugging
        // unexpected Notion payloads
        console.log("Skipping this page: ", { result });
        return undefined;
      }

      const simpleResult = { id: result.id } as Partial<DatabaseSchemaType> & { id: string };
      const properties = Object.entries(result.properties);

      for (const [columnName, result] of properties) {
        const camelizeColumnName = camelize(columnName);
        const columnType =
          camelPropertyNameToNameAndTypeMap[camelizeColumnName]?.type;

        if (columnType) {
          // @ts-expect-error
          simpleResult[camelizeColumnName] = getResponseValue(
            columnType,
            result
          );
        }
      }

      if (meta?.$icon) {
        const icon = (result as any).icon;
        if (icon?.type === "external") (simpleResult as any).$icon = icon.external?.url ?? null;
        else if (icon?.type === "file") (simpleResult as any).$icon = icon.file?.url ?? null;
        else (simpleResult as any).$icon = null;
      }
      if (meta?.$cover) {
        const cover = (result as any).cover;
        if (cover?.type === "external") (simpleResult as any).$cover = cover.external?.url ?? null;
        else if (cover?.type === "file") (simpleResult as any).$cover = cover.file?.url ?? null;
        else (simpleResult as any).$cover = null;
      }

      if (index === 0) {
        validateSchema(simpleResult);
      }
      return simpleResult;
    })
    .filter((result) => result !== undefined);

  return results as (Partial<DatabaseSchemaType> & { id: string })[];
}

/**
 * Extracts value from Notion property object based on column type
 */
export function getResponseValue(
  prop: SupportedNotionColumnType,
  x: Record<string, any>
) {
  switch (prop) {
    case "select": {
      const { select } = x;
      if (select) {
        return select["name"];
      }
      return null;
    }
    case "title": {
      const { title } = x;
      if (title) {
        const combinedText = title.map(
          ({ plain_text }: { plain_text: string }) => plain_text
        );
        return combinedText.join("");
      }
      return null;
    }
    case "url": {
      const { url } = x;
      return url;
    }
    case "multi_select": {
      const { multi_select } = x;
      if (multi_select) {
        const multi_selectArr: string[] = multi_select.map(
          ({ name }: { name: string }) => name
        );
        return multi_selectArr;
      }
      return null;
    }
    case "checkbox": {
      const { checkbox } = x;
      return Boolean(checkbox);
    }
    case "status": {
      const { status } = x;
      if (status) {
        return status["name"];
      }
      return null;
    }
    case "rich_text": {
      const { rich_text } = x;
      if (rich_text && Array.isArray(rich_text)) {
        const combinedText = rich_text.map(
          ({ plain_text }: { plain_text: string }) => plain_text
        );
        return combinedText.join("");
      }
      return null;
    }
    case "number": {
      const { number } = x;
      return number;
    }
    case "formula": {
      const { formula } = x;
      if (!formula) return null;
      if (formula.type === "date") return formula.date;
      return formula[formula.type] ?? null;
    }
    case "rollup": {
      const { rollup } = x;
      if (!rollup) return null;
      switch (rollup.type) {
        case "number": return rollup.number;
        case "date": return rollup.date;
        case "array": return rollup.array;
        default: return null;
      }
    }
    case "relation": {
      const { relation } = x;
      if (!Array.isArray(relation)) return null;
      return relation.map(({ id }: { id: string }) => id);
    }
    default: {
      return null;
    }
  }
}

/**
 * Recursively converts user query filters to Notion API filter format
 */
export function recursivelyBuildFilter<
  DatabaseSchemaType extends Record<string, any>,
  ColumnNameToColumnType extends Record<
    keyof DatabaseSchemaType,
    SupportedNotionColumnType
  >
>(
  queryFilter: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>,
  camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType
): apiFilterType {
  // Need to loop because we don't know the structure
  for (const prop in queryFilter) {
    // if the filter is "and" || "or" we need to recursively
    if (prop === "and" || prop === "or") {
      const compoundFilters: QueryFilter<
        DatabaseSchemaType,
        ColumnNameToColumnType
      >[] =
        // @ts-expect-error
        queryFilter[prop];

      const compoundApiFilters = compoundFilters.map(
        (i: QueryFilter<DatabaseSchemaType, ColumnNameToColumnType>) => {
          return recursivelyBuildFilter(i, camelPropertyNameToNameAndTypeMap);
        }
      );

      // Either have an `and` or an `or` compound filter
      const temp: apiFilterType = {
        ...(prop === "and"
          ? { and: compoundApiFilters }
          : { or: compoundApiFilters }),
      };
      return temp;
    } else {
      const propType = camelPropertyNameToNameAndTypeMap[prop].type;
      const temp: apiSingleFilter = {
        property: camelPropertyNameToNameAndTypeMap[prop].columnName,
      };

      //@ts-expect-error
      temp[propType] = (queryFilter as SingleFilter<ColumnNameToColumnType>)[
        prop
      ];
      return temp;
    }
  }
}

