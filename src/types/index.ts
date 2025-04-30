export interface VitePluginMockProxyOptions {
  /**
   * 代理服务器端口
   * @default 7171
   */
  port?: number;

  /**
   * 启用插件
   * @default true
   */
  enable?: boolean;

  /**
   * 状态码检查配置
   */
  statusCheck?: {
    /**
     * 需要拦截的状态码
     * @default [404]
     */
    codes?: number[];
    /**
     * 需要拦截的方法
     * @default ['GET']
     */
    methods?: string[];
  };

  /**
   * 需要拦截的请求路径
   */
  include?: (string | RegExp)[];

  /**
   * 需要拦截的请求路径
   */
  exclude?: (string | RegExp)[];

  /**
   * 环境变量配置
   */
  env?: {
    /**
     * AI 模型
     * @default 'gpt-4o-mini'
     */
    AI_MODEL?: string;

    /**
     * AI 服务 URL
     */
    AI_SERVICE_URL?: string;

    /**
     * OpenAI API 密钥
     */
    OPENAI_API_KEY?: string;

    /**
     * APIFOX 项目 ID
     */
    APIFOX_PROJECT_ID?: string;

    /**
     * APIFOX 基础 URL
     */
    APIFOX_BASE_URL?: string;

    /**
     * APIFOX 令牌
     */
    APIFOX_TOKEN?: string;

    /**
     * 其他环境变量
     */
    [key: string]: string | undefined;
  };

  /**
   * 调试模式
   * @default false
   */
  debug?: boolean;

  /**
   * 缓存过期时间
   * @default 30 * 60 * 1000
   */
  cacheExpire?: number;

  /**
   * MCP 配置
   */
  mcpServers?: MCPConfig;
}

export interface ProxyConfig {
  [key: string]: {
    target: string;
    changeOrigin?: boolean;
    secure?: boolean;
    rewrite?: (path: string) => string;
    [key: string]: any;
  };
}

export type MCPConfig = Record<
  string,
  {
    command: string;
    args: string[];
    type?: "stdio" | undefined;
    transport?: "stdio" | undefined;
    env?: Record<string, string> | undefined;
    encoding?: string | undefined;
    stderr?: "overlapped" | "pipe" | "ignore" | "inherit" | undefined;
    cwd?: string | undefined;
    restart?:
      | {
          enabled?: boolean | undefined;
          maxAttempts?: number | undefined;
          delayMs?: number | undefined;
        }
      | undefined;
  }
>;
