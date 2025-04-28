import type { Plugin, ResolvedConfig } from 'vite';
import { logger, enableDebugLogs, disableDebugLogs } from './utils/logger';
import type { ProxyServer,  } from './proxyServer/proxy-server';
import { createProxyServer } from './proxyServer/proxy-server';
import type { ProxyConfig, VitePluginMockProxyOptions } from './types';

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
 * Vite 插件：代理服务器拦截
 */
export default function vitePluginMockProxy(options: VitePluginMockProxyOptions = {}): Plugin {
  let proxyServer: ProxyServer | null = null;
  let config: ResolvedConfig;
  
  // 默认值合并
  const finalOptions: VitePluginMockProxyOptions = {
    port: options.port || 7171,
    enable: options.enable !== false,
    statusCheck: options.statusCheck || {},
    env: options.env || {},
    debug: options.debug || false,
    cacheExpire: options.cacheExpire || 30 * 60 * 1000,
    include: options.include || [],
    exclude: options.exclude || [],
  };
  
  // 是否启用调试模式
  if (finalOptions.debug) {
    enableDebugLogs();
    logger.info('调试模式已启用');
    // 设置环境变量 LOG_LEVEL 为 debug
    process.env.LOG_LEVEL = 'debug';
  } else {
    disableDebugLogs();
    process.env.LOG_LEVEL = 'info';
  }
  
  // 设置环境变量
  setupEnvVariables(finalOptions.env);

  return {
    name: 'vite-plugin-mock-proxy',
    
    configResolved(resolvedConfig) {
      config = resolvedConfig;
      
      // 尝试从 Vite 环境变量中获取值，如果插件配置中没有提供
      if (!finalOptions.env?.AI_MODEL && config.env.VITE_AI_MODEL) {
        process.env.AI_MODEL = config.env.VITE_AI_MODEL;
      }
      if (!finalOptions.env?.AI_SERVICE_URL && config.env.VITE_AI_SERVICE_URL) {
        process.env.AI_SERVICE_URL = config.env.VITE_AI_SERVICE_URL;
      }
      
      if (!finalOptions.env?.OPENAI_API_KEY && config.env.VITE_OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = config.env.VITE_OPENAI_API_KEY;
      }
    },
    
    /**
     * 服务启动时
     */
    async configureServer() {
      if (!finalOptions.enable) {
        logger.info('代理服务器已禁用');
        return;
      }
      
      const { server } = config;
      
      // 获取 Vite 代理配置
      const proxyConfig = server?.proxy || {};
      
      if (Object.keys(proxyConfig).length === 0) {
        logger.warn('未找到任何代理配置，代理服务器将不会启动');
        return;
      }
      
      const targetArr: string[] = [];
      // 更新 Vite 代理配置，指向我们的代理服务器
      if (typeof proxyConfig === 'object' && finalOptions.port) {
        const proxyServerUrl = `http://localhost:${finalOptions.port}`;
        
        
        // 遍历代理配置，修改 target 为我们的代理服务器
        for (const key of Object.keys(proxyConfig)) {
          const proxyOptions = proxyConfig[key];
          
          if (typeof proxyOptions === 'object') {
            // 备份原始目标，用于记录日志
            const originalTarget = proxyOptions.target;
            logger.info(`修改代理配置 ${key}: ${originalTarget} -> ${proxyServerUrl}`);
            if (typeof originalTarget === 'string') {
              targetArr.push(originalTarget);
            }
            
            // 修改为指向我们的代理服务器
            proxyOptions.target = proxyServerUrl;
            
            // 关闭 Vite 的路径重写，由我们的代理服务器处理
            if (proxyOptions.rewrite) {
              proxyOptions.rewrite = undefined;
            }
          }
        }
      }
      
      try {
        // 启动代理服务器
        proxyServer = createProxyServer(proxyConfig as ProxyConfig, targetArr, finalOptions);
        await proxyServer.start();
      } catch (error) {
        logger.error('启动代理服务器失败:', error);
      }
    },
    
    /**
     * 服务关闭时
     */
    async closeBundle() {
      if (proxyServer) {
        await proxyServer.stop();
        proxyServer = null;
      }
    },
  };
}