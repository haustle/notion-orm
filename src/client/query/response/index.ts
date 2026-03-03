import type { SupportedNotionColumnType } from "../../queryTypes";
import type { NotionPropertyValue, ResponseResolver } from "../types";
import { resolveCheckbox } from "./checkbox";
import { resolveCreatedBy } from "./created_by";
import { resolveCreatedTime } from "./created_time";
import { resolveDate } from "./date";
import { resolveEmail } from "./email";
import { resolveFiles } from "./files";
import { resolveFormula } from "./formula";
import { resolveLastEditedBy } from "./last_edited_by";
import { resolveLastEditedTime } from "./last_edited_time";
import { resolveMultiSelect } from "./multi_select";
import { resolveNumber } from "./number";
import { resolvePeople } from "./people";
import { resolvePhoneNumber } from "./phone_number";
import { resolveRelation } from "./relation";
import { resolveRichText } from "./rich_text";
import { resolveSelect } from "./select";
import { resolveStatus } from "./status";
import { resolveTitle } from "./title";
import { resolveUniqueId } from "./unique_id";
import { resolveUrl } from "./url";

export const simplifiedPropertyValueTransformers = {
	formula: resolveFormula,
	files: resolveFiles,
	people: resolvePeople,
	relation: resolveRelation,
	created_by: resolveCreatedBy,
	last_edited_by: resolveLastEditedBy,
	created_time: resolveCreatedTime,
	last_edited_time: resolveLastEditedTime,
	url: resolveUrl,
	phone_number: resolvePhoneNumber,
	title: resolveTitle,
	email: resolveEmail,
	checkbox: resolveCheckbox,
	date: resolveDate,
	multi_select: resolveMultiSelect,
	status: resolveStatus,
	number: resolveNumber,
	rich_text: resolveRichText,
	select: resolveSelect,
	unique_id: resolveUniqueId,
} as const satisfies Record<SupportedNotionColumnType, ResponseResolver>;

export function getSimplifiedResult(args: {
	columnType: SupportedNotionColumnType;
	propertyValue: NotionPropertyValue;
}) {
	return simplifiedPropertyValueTransformers[args.columnType](
		args.propertyValue,
	);
}
