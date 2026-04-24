import type { DataSourceFixtureSpec } from "./datasource-fixture-builder";
import type { AgentIcon } from "../../client/agent/AgentClient";

export interface DemoAgentFixture {
	id: string;
	name: string;
	icon: AgentIcon;
}

/**
 * Describes a single database example scenario shown in the playground editor.
 * Property value references are indices into the generated enum arrays.
 */
export interface DemoDatabaseScenario {
	targetDatabase: string;
	create: {
		schemaLiteral: Record<string, string | number | boolean | object>;
		icon?: { type: "emoji"; emoji: string };
	};
	findMany: {
		where: Record<string, Record<string, string | number | boolean>>;
		sortBy: Array<{ property: string; direction: "ascending" | "descending" }>;
	};
	count: {
		where: Record<string, Record<string, string | number | boolean>>;
	};
}

/**
 * Describes an agent example scenario shown in the playground editor.
 * Agent module names are derived from the fixture names at generation time.
 */
export interface DemoAgentScenario {
	chatAgent: string;
	chatMessage: string;
	streamAgent: string;
	streamMessage: string;
}

export interface DemoPlaygroundSpec {
	databases: DataSourceFixtureSpec[];
	agents: DemoAgentFixture[];
	databaseEntryFile: string;
	agentEntryFile: string;
	databaseScenario: DemoDatabaseScenario;
	agentScenario: DemoAgentScenario;
}

export const DEMO_PLAYGROUND_SPEC: DemoPlaygroundSpec = {
	databases: [
		{
			id: "b80f57aa-2f72-4f56-b89a-1d620e141111",
			title: "Coffee Shop Directory",
			properties: {
				"Shop Name": { type: "title" },
				"Has WiFi": { type: "checkbox" },
				Website: { type: "url" },
				"Last Visited": { type: "date" },
				Vibes: {
					type: "multi_select",
					options: ["Quiet", "Lively", "Brunch"],
				},
				Neighborhood: {
					type: "select",
					options: ["West Village", "Soho", "Lower East Side"],
				},
				Notes: { type: "rich_text" },
				"Visit Status": {
					type: "status",
					options: ["Want to Go", "Favorite", "Would Skip"],
				},
				Rating: { type: "number" },
				Email: { type: "email" },
				Phone: { type: "phone_number" },
			},
		},
		{
			id: "d32b4f70-52fd-4f80-b5d9-2e530cab2222",
			title: "Favorite Songs",
			properties: {
				Song: { type: "title" },
				Artist: { type: "rich_text" },
				Rating: {
					type: "select",
					options: ["★☆☆☆☆", "★★☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"],
				},
				Genre: {
					type: "multi_select",
					options: ["Hip-Hop", "Soul", "Pop", "Electronic"],
				},
				Released: { type: "date" },
			},
		},
	],
	agents: [
		{
			id: "agent-food-manager-demo",
			name: "Food Manager",
			icon: { type: "emoji", emoji: "🍽️" },
		},
		{
			id: "agent-web-clipper-demo",
			name: "Web Clipper",
			icon: { type: "emoji", emoji: "🧷" },
		},
	],
	databaseEntryFile: "demo-databases.ts",
	agentEntryFile: "demo-agents.ts",
	databaseScenario: {
		targetDatabase: "Favorite Songs",
		create: {
			schemaLiteral: {
				song: '"Midnight City"',
				artist: '"M83"',
				rating: "RatingPropertyValues[4]!",
				genre: "[GenrePropertyValues[3]!, GenrePropertyValues[0]!]",
				released: '{ start: "2011-10-17" }',
			},
			icon: { type: "emoji", emoji: "🎵" },
		},
		findMany: {
			where: {
				rating: { equals: "RatingPropertyValues[4]!" },
				genre: { contains: "GenrePropertyValues[0]!" },
			},
			sortBy: [{ property: "released", direction: "descending" }],
		},
		count: {
			where: { artist: { contains: '"M83"' } },
		},
	},
	agentScenario: {
		chatAgent: "Food Manager",
		chatMessage: "Plan a brunch spot in Soho with good Wi\u2011Fi.",
		streamAgent: "Web Clipper",
		streamMessage: "Summarize the open browser tab.",
	},
};
