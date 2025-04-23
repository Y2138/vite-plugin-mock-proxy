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
    
    logger.info('LangchainClient 实例已创建');
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
    logger.info(`mcp获取到的工具: ${tools.map(tool => tool.name)}`);
    this.agent = createReactAgent({
      llm: this.model,
      tools,
    });
    return this.agent;
  }

  async invoke(input: UpdateType<any>) {
    const agent = await this.getAgent();
    let apiResult;
    if (this.debug) {
      // 添加回调函数获取执行过程信息
      const callbacks = [
        {
          handleChainStart: (chain: any, inputs: any) => {
            logger.debug(`Agent chain开始执行: ${chain.id}`, { inputs });
          },
          handleChainEnd: (outputs: any) => {
            logger.debug('Agent chain执行结束', { outputs });
          },
          handleToolStart: (tool: any, input: any) => {
            logger.debug(`Agent tool开始执行: ${tool.name}`, { input });
          },
          handleToolEnd: (output: any) => {
            logger.debug('Agent tool执行结束', { output });
          },
          handleLLMStart: (llm: any, prompts: any) => {
            logger.debug('Agent LLM开始执行', { prompts: prompts.slice(0, 50) + '...' });
          },
          handleLLMEnd: (output: any) => {
            logger.debug('Agent LLM执行结束', { output });
          }
        }
      ];
      apiResult = await agent.invoke(input, { callbacks });
    } else {
      apiResult = await agent.invoke(input);
    }

    return dealWithApiResult(apiResult);
  }

  async close() {
    if (this.client) {
      await this.client.close();
    }
  }
}