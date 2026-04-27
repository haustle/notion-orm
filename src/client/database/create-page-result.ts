import type {
	CreatePageResponse,
	PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import {
	DATABASE_CREATE_PAGE_RESULT_PAGE_KEYS,
	type DatabaseCreatePageResult,
} from "./types/crud";

/**
 * `CreatePageResponse` is either a full {@link PageObjectResponse} or {@link PartialPageObjectResponse}.
 * A partial body only includes `id` and `object`; full pages always include these timestamps and `url`.
 */
function isFullPageObjectResponse(
	response: CreatePageResponse,
): response is PageObjectResponse {
	return (
		"url" in response &&
		"properties" in response &&
		"created_time" in response &&
		"last_edited_time" in response
	);
}

function pickFieldsFromFullCreatePage(
	page: PageObjectResponse,
): Pick<
	PageObjectResponse,
	(typeof DATABASE_CREATE_PAGE_RESULT_PAGE_KEYS)[number]
> {
	return {
		id: page.id,
		object: page.object,
		url: page.url,
		properties: page.properties,
		created_time: page.created_time,
		last_edited_time: page.last_edited_time,
	} satisfies Pick<
		PageObjectResponse,
		(typeof DATABASE_CREATE_PAGE_RESULT_PAGE_KEYS)[number]
	>;
}

/**
 * Builds the value returned from {@link DatabaseClient#create} so it only contains fields that are
 * part of {@link DATABASE_CREATE_PAGE_RESULT_PAGE_KEYS} (when Notion returns a full page).
 */
export function pickDatabaseCreatePageResultFromResponse(
	response: CreatePageResponse,
): DatabaseCreatePageResult {
	if (!isFullPageObjectResponse(response)) {
		return { id: response.id, object: response.object };
	}
	return pickFieldsFromFullCreatePage(response);
}
