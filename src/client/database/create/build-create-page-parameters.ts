import type {
	CreatePageParameters,
} from "@notionhq/client/build/src/api-endpoints";

export function buildCreatePageParametersForDataSource(args: {
	dataSourceId: string;
	properties: NonNullable<CreatePageParameters["properties"]>;
	icon?: CreatePageParameters["icon"];
	cover?: CreatePageParameters["cover"];
	markdown?: CreatePageParameters["markdown"];
}): CreatePageParameters {
	return {
		parent: {
			data_source_id: args.dataSourceId,
			type: "data_source_id",
		},
		properties: args.properties,
		icon: args.icon,
		cover: args.cover,
		markdown: args.markdown,
	};
}
