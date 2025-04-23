interface VitePluginMockProxyOptions {
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
}

export { VitePluginMockProxyOptions };