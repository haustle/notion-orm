import type { QueryDataSourceResponse } from "@notionhq/client/build/src/api-endpoints";
import type {
  apiFilterType,
  apiSingleFilter,
  QueryFilter,
  SimpleQueryResponse,
  SingleFilter,
  SupportedNotionColumnType,
} from "./queryTypes";
import type { camelPropertyNameToNameAndTypeMapType } from "./DatabaseClient";
import { camelize } from "../helpers";

/**
 * Transforms Notion API query response into simplified format
 */
export function buildQueryResponse<DatabaseSchemaType extends Record<string, any>>(
  res: QueryDataSourceResponse,
  camelPropertyNameToNameAndTypeMap: camelPropertyNameToNameAndTypeMapType,
  validateSchema: (result: Partial<DatabaseSchemaType>) => void
): SimpleQueryResponse<DatabaseSchemaType> {
  const rawResults = res.results;
  const rawResponse = res;

  const results: Array<Partial<DatabaseSchemaType>> = rawResults
    .map((result, index) => {
      if (result.object === "page" && !("properties" in result)) {
        // biome-ignore lint/suspicious/noConsole: surfaced for debugging
        // unexpected Notion payloads
        console.log("Skipping this page: ", { result });
        return undefined;
      }

      const simpleResult: Partial<DatabaseSchemaType> = {};
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

      if (index === 0) {
        validateSchema(simpleResult);
      }
      return simpleResult;
    })
    .filter((result) => result !== undefined);

  return {
    results,
    rawResponse,
  };
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

