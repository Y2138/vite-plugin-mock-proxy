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
     * 认为接口准备好的状态码范围
     * @default [200, 299]
     */
    readyRange?: [number, number];
  };

  /**
   * 环境变量配置
   */
  env?: {
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