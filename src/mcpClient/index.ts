import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { UpdateType } from '@langchain/langgraph';
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { logger } from "../utils/logger";

function dealWithApiResult(aiResult: any) {
  const lastContent = aiResult.messages[aiResult.messages.length - 1].content;
  console.log(`调用mcp获取到的数据 第${aiResult.messages.length - 1}条数据 item.content====>: `, lastContent.substring(0, 20));
  return lastContent;
}

export class LangchainClient {
  private client: MultiServerMCPClient;
  private model: ChatOpenAI;
  private agent: ReturnType<typeof createReactAgent> | null = null;
  
  // 单例实例
  private static instance: LangchainClient | null = null;

  /**
   * 私有构造函数，防止外部直接创建实例
   */
  private constructor() {
    // Create client and connect to server
    this.client = new MultiServerMCPClient({
      // Global tool configuration options
      // Whether to throw on errors if a tool fails to load (optional, default: true)
      throwOnLoadError: true,
      // Whether to prefix tool names with the server name (optional, default: true)
      prefixToolNameWithServerName: false,
      // Optional additional prefix for tool names (optional, default: "mcp")
      additionalToolNamePrefix: "",
    
      // Server configuration
      mcpServers: {
        "API Docs": {
          command: "npx",
          args: [
            "-y",
            "apifox-mcp-server@latest",
            "--project=345255",
            "--apifox-api-base-url=https://apifox.qmniu.com",
            "--token=APS-0iXsMQTaxIOeGtShuNbzPZLoYzdkxvp7"
          ],
        },
        "npm-search": {
          "command": "npx",
          "args": ["-y", "npm-search-mcp-server"]
        },
      },
    });

    // // Create an OpenAI model
    this.model = new ChatOpenAI({
      // modelName: "Qwen/QwQ-32B",
      modelName: process.env.AI_MODEL || "Qwen/QwQ-32B",
      temperature: 0,
      configuration: {
        baseURL: process.env.AI_SERVICE_URL || "https://api.siliconflow.cn/v1",
        apiKey: process.env.OPENAI_API_KEY || "sk-rlcebhmzzznirhwiijsssfktvmsvsmtkttftyjzouvuzvisb",
      },
    });
    
    logger.info('LangchainClient 实例已创建');
  }

  /**
   * 获取 LangchainClient 单例实例
   */
  public static getInstance(): LangchainClient {
    if (!LangchainClient.instance) {
      LangchainClient.instance = new LangchainClient();
    }
    return LangchainClient.instance;
  }

  /**
   * 重置单例（主要用于测试）
   */
  public static reset(): void {
    if (LangchainClient.instance) {
      LangchainClient.instance.close().catch(err => {
        logger.error('关闭 LangchainClient 失败:', err);
      });
      LangchainClient.instance = null;
    }
  }

  // async getTools() {
  //   return this.client.getTools();
  // }

  async getAgent(): Promise<ReturnType<typeof createReactAgent>> {
    if (this.agent) {
      return this.agent;
    }
    // Create the React agent
    const tools = await this.client.getTools();
    logger.info(`mcp获取到的工具: ${tools}`);
    this.agent = createReactAgent({
      llm: this.model,
      tools,
    });
    return this.agent;
  }

  async invoke(input: UpdateType<any>) {
    const agent = await this.getAgent();
    const apiResult = await agent.invoke(input);

    return dealWithApiResult(apiResult);
  }

  async close() {
    if (this.client) {
      await this.client.close();
    }
  }
}