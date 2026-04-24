// Be sure to create a .env file and add your NOTION_KEY
// If you don't have an API key, sign up for free
// [here](https://developers.notion.com)
const auth = process.env.NOTION_KEY || "your-notion-api-key-here";
const NotionConfig = {
	auth,
	// Use: notion add <database-id> --type database
	databases: [],
	// Agents are auto-populated by: notion sync
	agents: []
};
export default NotionConfig;
