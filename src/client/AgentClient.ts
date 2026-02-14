import {
	type Agent,
	collectMessages,
	NotionAgentsClient,
	type PollThreadOptions,
	StreamError,
	stripLangTags,
	type ThreadInfo,
	type ThreadListItem,
	type ThreadStatus,
} from "@notionhq/agents-client";

export class AgentClient {
	public readonly id: string;
	public readonly name: string;
	private readonly client: NotionAgentsClient;
	private readonly agent: Agent;

	constructor(props: { auth: string; id: string; name: string }) {
		this.id = props.id;
		this.name = props.name;
		this.client = new NotionAgentsClient({
			auth: props.auth,
		});
		this.agent = this.client.agents.agent(this.id);
	}

	async listThreads(): Promise<
		{
			id: string;
			title: string;
			status: ThreadStatus;
		}[]
	> {
		const threads = await this.agent.listThreads();
		const response = threads.results.map(
			(thread: { id: string; title: string; status: ThreadStatus }) => ({
				id: thread.id,
				title: thread.title,
				status: thread.status,
			}),
		);
		return response;
	}

	async getThreadInfo(threadId: string): Promise<ThreadListItem> {
		return this.agent.getThread(threadId);
	}

	async getThreadTitle(threadId: string): Promise<string> {
		const threadInfo = await this.getThreadInfo(threadId);
		return threadInfo.title;
	}

	/**
	 * Chat with the agent
	 * @param props - The properties of the chat
	 * @param props.message - The message to send to the agent
	 * @param props.threadId - The thread ID to resume
	 * @returns The response from the agent
	 */
	async chat(props: { message: string; threadId?: string }): Promise<{
		status: ThreadStatus;
		threadId: string;
		isNewChat: boolean;
	}> {
		const { message, threadId } = props;
		const response = await this.agent.chat({
			message,
			threadId,
		});

		if (threadId && threadId !== response.thread_id) {
			throw new Error("Tried to resume a different thread");
		}
		return {
			status: response.status,
			threadId: response.thread_id,
			isNewChat: threadId === undefined,
		};
	}

	/**
	 * Stream a chat conversation with the agent
	 * @param props - The properties of the chat stream
	 * @param props.message - The message to send to the agent
	 * @param props.threadId - The thread ID to resume (optional)
	 * @param props.onMessage - Optional callback for each message received
	 * @returns ThreadInfo containing thread_id, agent_id, and all messages
	 */
	async chatStream(props: {
		message: string;
		threadId?: string;
		onMessage?: (message: { role: "user" | "agent"; content: string }) => void;
	}): Promise<ThreadInfo> {
		const { message, threadId, onMessage } = props;

		try {
			const generator = this.agent.chatStream({
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

			// Iterate through all chunks to completion
			// The generator's return value (ThreadInfo) is available when done is true
			let result = await generator.next();
			while (!result.done) {
				result = await generator.next();
			}

			if (!result.value) {
				throw new Error("Failed to get thread info from stream");
			}

			return result.value;
		} catch (error) {
			if (error instanceof StreamError) {
				throw new Error(`Stream error [${error.code}]: ${error.message}`);
			}
			throw error;
		}
	}

	/**
	 * Extract cleaned agent messages from ThreadInfo
	 * @param threadInfo - The ThreadInfo from chatStream
	 * @returns Cleaned agent message content (with lang tags stripped)
	 */
	static getAgentResponse(threadInfo: ThreadInfo): string {
		return threadInfo.messages
			.filter((msg) => msg.role === "agent")
			.map((msg) => stripLangTags(msg.content))
			.join("");
	}

	/**
	 * Get all messages from a thread
	 * @param threadId - The thread ID to get messages from
	 * @param options - Optional filtering options
	 * @param options.role - Filter messages by role (optional)
	 * @returns Array of all messages in the thread
	 */
	async getMessages(
		threadId: string,
		options?: { role?: "user" | "agent" },
	): Promise<Array<{ role: "user" | "agent"; content: string }>> {
		const thread = this.agent.thread(threadId);
		const allMessages = await collectMessages(thread, options);
		return allMessages.map((message) => ({
			role: message.role,
			content: message.content,
		}));
	}

	/**
	 * Poll a thread until completion
	 * @param threadId - The thread ID to poll
	 * @param options - Optional polling configuration
	 * @returns Thread info with status, threadId, and title
	 */
	async pollThread(
		threadId: string,
		options?: Partial<PollThreadOptions>,
	): Promise<{
		status: ThreadStatus;
		threadId: string;
		title?: string;
	}> {
		const thread = this.agent.thread(threadId);
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
