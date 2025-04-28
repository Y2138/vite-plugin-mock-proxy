import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import type { UpdateType } from '@langchain/langgraph';
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { logger } from "../utils/logger";

function dealWithApiResult(aiResult: any, debug: boolean) {
  if (debug) {
    logger.debug(`本次AI调用次数 ${aiResult.messages.length}`);
    for (const message of aiResult.messages) {
      logger.debug(`AI返回结果:   ${message.content}`, {message});
    }
  }
  const lastContent = aiResult.messages[aiResult.messages.length - 1].content;
  return lastContent;
}

export class LangchainClient {
  private client: MultiServerMCPClient;
  private model: ChatOpenAI;
  private agent: ReturnType<typeof createReactAgent> | null = null;
  private debug: boolean;
  // 单例实例
  private static instance: LangchainClient | null = null;

  /**
   * 私有构造函数，防止外部直接创建实例
   */
  private constructor({ debug = false }: { debug?: boolean } = {}) {
    this.debug = debug;
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
      modelName: process.env.AI_MODEL,
      temperature: 0,
      configuration: {
        baseURL: process.env.AI_SERVICE_URL,
        apiKey: process.env.OPENAI_API_KEY,
      },
    });
    
    logger.info('LangchainClient 实例已创建', {
      modelName: process.env.AI_MODEL,
      baseURL: process.env.AI_SERVICE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * 获取 LangchainClient 单例实例
   */
  public static getInstance({ debug = false }: { debug?: boolean } = {}): LangchainClient {
    if (!LangchainClient.instance) {
      LangchainClient.instance = new LangchainClient({ debug });
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
    logger.debug(`mcp获取到的工具: ${tools.map(tool => tool.name)}`);
    this.agent = createReactAgent({
      llm: this.model,
      tools,
    });
    return this.agent;
  }
  // TODO 调用agent只会执行一次
  async invoke(input: UpdateType<any>) {
    const agent = await this.getAgent();
    const apiResult = await agent.invoke(input, { recursionLimit: 20 });

    return dealWithApiResult(apiResult, this.debug);
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.agent = null;
    }
  }
}