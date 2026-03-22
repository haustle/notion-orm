"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.edgeCases = exports.EdgeCasesSchema = void 0;
const notion_orm_1 = require("@haustle/notion-orm");
const zod_1 = require("zod");
const id = "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6";
exports.EdgeCasesSchema = zod_1.z.object({
    name: zod_1.z.string(),
    attachments: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        url: zod_1.z.string()
    })).nullable().optional(),
    assignees: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    relatedItems: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    createdBy: zod_1.z.string().nullable().optional(),
    lastEditedBy: zod_1.z.string().nullable().optional(),
    createdAt: zod_1.z.string().nullable().optional(),
    updatedAt: zod_1.z.string().nullable().optional()
});
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
};
const edgeCases = (auth) => new notion_orm_1.DatabaseClient({ id, camelPropertyNameToNameAndTypeMap: columnNameToColumnProperties, schema: exports.EdgeCasesSchema, name: "Edge Cases", auth });
exports.edgeCases = edgeCases;
