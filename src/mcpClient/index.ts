import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import type { UpdateType } from '@langchain/langgraph';
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { logger } from "../utils/logger";
import type { MCPConfig } from "../types";

function dealWithApiResult(aiResult: any) {
  logger.debug(`本次AI调用次数 ${aiResult.messages.length}`);
  for (const message of aiResult.messages) {
    logger.debug(`AI返回结果:   ${message.content}`);
  }
  const lastContent = aiResult.messages[aiResult.messages.length - 1].content;
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
  private constructor(mcpServers: MCPConfig = {}) {
    const mergedMcpServers = {
      "API Docs": {
        command: "npx",
        args: [
          "-y",
          "apifox-mcp-server@latest",
          `--project=${process.env.APIFOX_PROJECT_ID}`,
          `--apifox-api-base-url=${process.env.APIFOX_BASE_URL}`,
          `--token=${process.env.APIFOX_TOKEN}`
        ],
      },
      ...mcpServers,
    }
    // Create client and connect to server
    this.client = new MultiServerMCPClient({
      // Global tool configuration options
      // Whether to throw on errors if a tool fails to load (optional, default: true)
      throwOnLoadError: true,
      // Whether to prefix tool names with the server name (optional, default: true)
      prefixToolNameWithServerName: true,
      // Optional additional prefix for tool names (optional, default: "mcp")
      additionalToolNamePrefix: "mcp",
    
      // Server configuration
      mcpServers: mergedMcpServers,
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
    
    logger.debug('LangchainClient 实例已创建', {
      modelName: process.env.AI_MODEL,
      baseURL: process.env.AI_SERVICE_URL,
      apiKey: process.env.OPENAI_API_KEY,
      apifoxProjectId: process.env.APIFOX_PROJECT_ID,
      apifoxBaseUrl: process.env.APIFOX_BASE_URL,
      apifoxToken: process.env.APIFOX_TOKEN,
    });
  }

  /**
   * 获取 LangchainClient 单例实例
   */
  public static getInstance(mcpServers: MCPConfig = {}): LangchainClient {
    if (!LangchainClient.instance) {
      LangchainClient.instance = new LangchainClient(mcpServers);
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

    return dealWithApiResult(apiResult);
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.agent = null;
    }
  }
}