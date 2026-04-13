import type {
	Agent,
	ThreadInfo as NotionThreadInfo,
	PollThreadOptions,
	ThreadListItem,
	ThreadStatus,
} from "@notionhq/agents-client";
import { loadAgentsSdk, stripLangTags } from "../../agents-sdk-resolver";

export type ThreadInfo = {
	threadId: NotionThreadInfo["thread_id"];
	agentId: NotionThreadInfo["agent_id"];
	messages: NotionThreadInfo["messages"];
};

export type AgentIcon =
	| { type: "emoji"; emoji: string }
	| { type: "file"; file: { url: string; expiry_time: string } }
	| { type: "external"; external: { url: string } }
	| {
			type: "custom_emoji";
			custom_emoji: { id: string; name: string; url: string };
	  }
	| {
			type: "custom_agent_avatar";
			custom_agent_avatar: { static_url: string; animated_url: string };
	  }
	| null;

type LazyClient = {
	sdk: typeof import("@notionhq/agents-client");
	agent: Agent;
};

export class AgentClient {
	public readonly id: string;
	public readonly name: string;
	public readonly icon: AgentIcon;
	private readonly auth: string;
	private _lazy: LazyClient | null = null;

	constructor(props: {
		auth: string;
		id: string;
		name: string;
		icon?: AgentIcon;
	}) {
		this.id = props.id;
		this.name = props.name;
		this.icon = props.icon ?? null;
		this.auth = props.auth;
	}

	private async ensureClient(): Promise<LazyClient> {
		if (this._lazy) {
			return this._lazy;
		}

		const sdk = await loadAgentsSdk();
		const client = new sdk.NotionAgentsClient({ auth: this.auth });
		this._lazy = { sdk, agent: client.agents.agent(this.id) };
		return this._lazy;
	}

	async listThreads(): Promise<
		{
			id: string;
			title: string;
			status: ThreadStatus;
		}[]
	> {
		const { agent } = await this.ensureClient();
		const threads = await agent.listThreads();
		return threads.results.map((thread) => ({
			id: thread.id,
			title: thread.title,
			status: thread.status,
		}));
	}

	async getThreadInfo(threadId: string): Promise<ThreadListItem> {
		const { agent } = await this.ensureClient();
		return agent.getThread(threadId);
	}

	async getThreadTitle(threadId: string): Promise<string> {
		const threadInfo = await this.getThreadInfo(threadId);
		return threadInfo.title;
	}

	async chat(props: { message: string; threadId?: string }): Promise<{
		status: ThreadStatus;
		threadId: string;
		isNewChat: boolean;
	}> {
		const { agent } = await this.ensureClient();
		const { message, threadId } = props;
		const response = await agent.chat({ message, threadId });

		if (threadId && threadId !== response.thread_id) {
			throw new Error("Tried to resume a different thread");
		}
		return {
			status: response.status,
			threadId: response.thread_id,
			isNewChat: threadId === undefined,
		};
	}

	async chatStream(props: {
		message: string;
		threadId?: string;
		onMessage?: (message: { role: "user" | "agent"; content: string }) => void;
	}): Promise<ThreadInfo> {
		const { agent, sdk } = await this.ensureClient();
		const { message, threadId, onMessage } = props;

		try {
			const generator = agent.chatStream({
				message,
				threadId,
				onMessage: onMessage
					? (msg) => {
							onMessage({
								role: msg.role,
								content: stripLangTags(msg.content),
							});
						}
					: undefined,
			});

			let result = await generator.next();
			while (!result.done) {
				result = await generator.next();
			}

			if (!result.value) {
				throw new Error("Failed to get thread info from stream");
			}

			return {
				threadId: result.value.thread_id,
				agentId: result.value.agent_id,
				messages: result.value.messages,
			};
		} catch (error) {
			if (error instanceof sdk.StreamError) {
				throw new Error(`Stream error [${error.code}]: ${error.message}`);
			}
			throw error;
		}
	}

	static getAgentResponse(threadInfo: ThreadInfo): string {
		return threadInfo.messages
			.filter((msg) => msg.role === "agent")
			.map((msg) => stripLangTags(msg.content))
			.join("");
	}

	async getMessages(
		threadId: string,
		options?: { role?: "user" | "agent" },
	): Promise<Array<{ role: "user" | "agent"; content: string }>> {
		const { agent, sdk } = await this.ensureClient();
		const thread = agent.thread(threadId);
		const allMessages = await sdk.collectMessages(thread, options);
		return allMessages.map((message) => ({
			role: message.role,
			content: message.content,
		}));
	}

	async pollThread(
		threadId: string,
		options?: Partial<PollThreadOptions>,
	): Promise<{
		status: ThreadStatus;
		threadId: string;
		title?: string;
	}> {
		const { agent } = await this.ensureClient();
		const thread = agent.thread(threadId);
		const defaults: PollThreadOptions = {
			maxAttempts: 60,
			baseDelayMs: 1000,
			maxDelayMs: 10000,
			initialDelayMs: 1000,
		};
		const pollOptions = { ...defaults, ...options };
		const result = await thread.poll(pollOptions);
		return {
			status: result.status,
			threadId: result.id,
			title: result.title,
		};
	}
}
