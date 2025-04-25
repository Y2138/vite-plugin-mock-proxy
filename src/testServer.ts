import { createProxyServer } from './proxyServer/proxy-server';
import { logger, enableDebugLogs, disableDebugLogs } from './utils/logger';
import type { ProxyServer } from './proxyServer/proxy-server';

// 定义代理配置类型
interface ProxyConfigItem {
  target: string;
  changeOrigin?: boolean;
  secure?: boolean;
  rewrite?: (path: string) => string;
  [key: string]: unknown;
}

type ProxyConfigType = Record<string, ProxyConfigItem>;

/**
 * 设置环境变量
 */
function setupEnvVariables(env?: Record<string, string | undefined>) {
  if (!env) return;
  
  // 将配置选项中的环境变量设置到 process.env 中
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      logger.debug(`设置环境变量: ${key}`);
      process.env[key] = value;
    }
  }
}

/**
 * 启动代理服务器
 * @param proxyConfig 代理配置
 * @param options 选项配置
 * @returns 返回代理服务器实例，失败返回null
 */
export async function startServer(
  proxyConfig: ProxyConfigType, 
  options: VitePluginMockProxyOptions = {}
): Promise<ProxyServer | null> {
  const finalOptions: VitePluginMockProxyOptions = {
    port: options.port || 7171,
    enable: options.enable !== false,
    statusCheck: options.statusCheck || {},
    env: options.env || {},
    debug: options.debug || false,
    cacheExpire: options.cacheExpire || 30 * 60 * 1000,
    include: options.include || [],
    exclude: options.exclude || []
  };
  
  // 启用调试模式
  if (finalOptions.debug) {
    enableDebugLogs();
    logger.info('调试模式已启用');
    process.env.LOG_LEVEL = 'debug';
  } else {
    disableDebugLogs();
    process.env.LOG_LEVEL = 'info';
  }
  
  // 设置环境变量
  setupEnvVariables(finalOptions.env);
  
  if (Object.keys(proxyConfig).length === 0) {
    logger.warn('未找到任何代理配置，代理服务器将不会启动');
    return null;
  }
  
  try {
    // 启动代理服务器
    const proxyServer = createProxyServer(proxyConfig, finalOptions);
    await proxyServer.start();
    logger.info(`代理服务器启动成功，端口: ${finalOptions.port}`);
    return proxyServer;
  } catch (error) {
    logger.error('启动代理服务器失败:', error);
    return null;
  }
}

startServer({
  '/api': {
    target: 'http://api-infrastructure.qmniu.com/',
    changeOrigin: true,
  },
}, {
  env: {
    AI_MODEL: 'Qwen/QwQ-32B',
    AI_SERVICE_URL: 'https://api.siliconflow.cn/v1',
    OPENAI_API_KEY: 'sk-rlcebhmzzznirhwiijsssfktvmsvsmtkttftyjzouvuzvisb',
  },
  debug: true
})