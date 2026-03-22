import { DatabaseClient } from "@haustle/notion-orm";
import { z } from "zod";
import type { Query } from "@haustle/notion-orm";
const id = "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6";
export const EdgeCasesSchema = z.object({
    name: z.string(),
    attachments: z.array(z.object({
        name: z.string(),
        url: z.string()
    })).nullable().optional(),
    assignees: z.array(z.string()).nullable().optional(),
    relatedItems: z.array(z.string()).nullable().optional(),
    createdBy: z.string().nullable().optional(),
    lastEditedBy: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional()
});
export type DatabaseSchemaType = {
    name: string;
    attachments?: {
        name: string;
        url: string;
    }[];
    assignees?: string[];
    relatedItems?: string[];
    createdBy?: string;
    lastEditedBy?: string;
    createdAt?: string;
    updatedAt?: string;
};
const columnNameToColumnProperties = {
    "name": {
        columnName: "Name",
        type: "title"
    },
    "attachments": {
        columnName: "Attachments",
        type: "files"
    },
    "assignees": {
        columnName: "Assignees",
        type: "people"
    },
    "relatedItems": {
        columnName: "Related Items",
        type: "relation"
    },
    "createdBy": {
        columnName: "Created By",
        type: "created_by"
    },
    "lastEditedBy": {
        columnName: "Last Edited By",
        type: "last_edited_by"
    },
    "createdAt": {
        columnName: "Created At",
        type: "created_time"
    },
    "updatedAt": {
        columnName: "Updated At",
        type: "last_edited_time"
    }
} as const;
type ColumnNameToColumnType = {
    [Property in keyof typeof columnNameToColumnProperties]: (typeof columnNameToColumnProperties)[Property]["type"];
};
export type QuerySchemaType = Query<DatabaseSchemaType, ColumnNameToColumnType>;
export const edgeCases = (auth: string) => new DatabaseClient<DatabaseSchemaType, ColumnNameToColumnType>({ id, camelPropertyNameToNameAndTypeMap: columnNameToColumnProperties, schema: EdgeCasesSchema, name: "Edge Cases", auth });
export type edgeCasesSchema = DatabaseSchemaType;
export type edgeCasesColumnTypes = ColumnNameToColumnType;
export type EdgeCasesSchemaType = z.infer<typeof EdgeCasesSchema>;
