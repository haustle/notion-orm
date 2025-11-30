import { AST_RUNTIME_CONSTANTS } from "../ast/constants";
import { SupportedNotionColumnType } from "./queryTypes";

export function buildPropertyValueForAddPage(args: {
  type: SupportedNotionColumnType;
  value: string | number | boolean;
}) {
  const { type, value } = args;
  if (type === "select" && typeof value === "string") {
    return selectCall({ value });
  } else if (type === "multi_select" && Array.isArray(value)) {
    return multiSelectCall({ value });
  } else if (type === "status" && typeof value === "string") {
    return statusCall({ option: value });
  } else if (type === "number" && typeof value === "number") {
    return numberCall({ value });
  } else if (type === "email" && typeof value === "string") {
    return emailCall({ value });
  } else if (type === "date" && typeof value === "object") {
    return dateCall({ value });
  } else if (type === "phone_number" && typeof value === "string") {
    return phoneNumberCall({ value });
  } else if (type === "url" && typeof value === "string") {
    return urlCall({ url: value });
  } else if (type === "checkbox" && typeof value === "boolean") {
    return checkboxCall({ checked: value });
  } else if (type === "title" && typeof value === "string") {
    return titleCall({ title: value });
  } else if (type === "rich_text" && typeof value === "string") {
    return textCall({ text: value });
  } else {
    console.error(
      `'${AST_RUNTIME_CONSTANTS.PACKAGE_LOG_PREFIX} ${type}' column type currently not supported`
    );
  }
}

/* 
======================================================
GENERATE OBJECT BASED ON TYPE
======================================================
*/

const selectCall = (args: { value: string }) => {
  const { value } = args;
  const select = {
    name: value,
  };
  return { select };
};

const dateCall = (args: { value: { start: string; end?: string } }) => {
  const { value } = args;
  return { date: value };
};
const phoneNumberCall = (args: { value: string }) => {
  const { value } = args;
  return { phone_number: value };
};

const statusCall = (args: { option: string }) => {
  const { option } = args;
  const status = {
    name: option,
  };
  return { status };
};

const multiSelectCall = (args: { value: Array<string> }) => {
  const { value } = args;
  const multi_select = value.map((option) => ({ name: option }));
  return { multi_select };
};

const textCall = (args: { text: string }) => {
  const { text } = args;
  const rich_text = [
    {
      text: {
        content: text,
      },
    },
  ];

  return { rich_text };
};

const titleCall = (args: { title: string }) => {
  const { title } = args;
  const titleObject = [
    {
      text: {
        content: title,
      },
    },
  ];

  return { title: titleObject };
};

const numberCall = (args: { value: number }) => {
  const { value: number } = args;
  return { number };
};

const urlCall = (args: { url: string }) => {
  const { url } = args;
  return { url };
};

const checkboxCall = (args: { checked: boolean }) => {
  const { checked: checkbox } = args;
  return { checkbox };
};

const emailCall = (args: { value: string }) => {
  const { value } = args;
  return { email: value };
};
