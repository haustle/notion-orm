declare module "@notionhq/agents-client" {
	export type ThreadStatus = string;

	export type AgentMessage = {
		role: "user" | "agent";
		content: string;
	};

	export type ThreadInfo = {
		thread_id: string;
		agent_id: string;
		messages: AgentMessage[];
	};

	export type ThreadListItem = {
		id: string;
		title: string;
		status: ThreadStatus;
	};

	export type PollThreadOptions = {
		maxAttempts: number;
		baseDelayMs: number;
		maxDelayMs: number;
		initialDelayMs: number;
	};

	export class StreamError extends Error {
		code: string;
	}

	export type ThreadRef = {
		poll: (
			options: PollThreadOptions,
		) => Promise<{ status: ThreadStatus; id: string; title?: string }>;
	};

	export type Agent = {
		listThreads: () => Promise<{ results: ThreadListItem[] }>;
		getThread: (threadId: string) => Promise<ThreadListItem>;
		chat: (props: {
			message: string;
			threadId?: string;
		}) => Promise<{ status: ThreadStatus; thread_id: string }>;
		chatStream: (props: {
			message: string;
			threadId?: string;
			onMessage?: (message: AgentMessage) => void;
		}) => AsyncGenerator<unknown, ThreadInfo, unknown>;
		thread: (threadId: string) => ThreadRef;
	};

	export type AgentIcon =
		| { type: "emoji"; emoji: string }
		| { type: "file"; file: { url: string; expiry_time: string } }
		| { type: "external"; external: { url: string } }
		| { type: "custom_emoji"; custom_emoji: { id: string; name: string; url: string } }
		| {
				type: "custom_agent_avatar"
				custom_agent_avatar: { static_url: string; animated_url: string }
		  }
		| null;

	export class NotionAgentsClient {
		constructor(props: { auth: string });
		agents: {
			list: (props: {
				page_size?: number;
			}) => Promise<{
				results: Array<{
					id: string
					name: string
					icon: AgentIcon
				}>
			}>;
			agent: (agentId: string) => Agent;
		};
	}

	export function collectMessages(
		thread: ThreadRef,
		options?: { role?: "user" | "agent" },
	): Promise<AgentMessage[]>;

	export function stripLangTags(content: string): string;
}
