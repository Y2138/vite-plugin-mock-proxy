import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Server, ServerResponse } from 'node:http';
import { logger } from '../utils/logger';
import { getMockDataByAi } from '../genMockData';
import { LangchainClient } from '../mcpClient';
import { MemoryCache } from '../utils/cache';
import { isMatchUrl } from '../utils';
import type { ProxyConfig, VitePluginMockProxyOptions } from '../types';

export interface ProxyServerConfig {
  proxyConfigs: ProxyConfig;
  targetArr: string[];
  pluginOptions: VitePluginMockProxyOptions;
}

export class ProxyServer {
  private app: express.Express;
  private server: Server | null = null;
  private config: ProxyServerConfig;
  private mockDataCache: MemoryCache<any>;

  constructor(config: ProxyServerConfig) {
    this.config = config;
    this.app = express();
    this.mockDataCache = new MemoryCache<any>(config.pluginOptions.cacheExpire);
    // 添加简单的请求日志中间件
    this.app.use((req, res, next) => {
      res.on('error', (error) => {
        logger.error('响应错误', { error });
      });
      next();
    });

    // 初始化代理
    this.setupProxy();
  }

  private setupProxy() {
    const { proxyConfigs, targetArr, pluginOptions } = this.config;
    const { statusCheck, debug } = pluginOptions;
    let index = 0;
    // 遍历代理配置
    for (const context of Object.keys(proxyConfigs)) {
      const options = proxyConfigs[context];
      const { rewrite, ...proxyOptions } = options;
      const target = targetArr[index];
      if (process.env.LOG_LEVEL === 'debug') {
        logger.debug(`设置代理路径 ${context} -> ${target}`, { 
          rewrite: !!rewrite,
          options: proxyOptions 
        });
      }
      
      const pathRewrite: Record<string, string> = {};
      if (rewrite) {
        // 构造路径重写规则
        pathRewrite[`^${context}`] = rewrite(context).replace(/^\//, '');
        logger.debug("配置路径重写规则", { rule: pathRewrite });
      }
      console.log('inputConfig rewrite', pathRewrite.toString());
      logger.debug('pathRewrite', pathRewrite);

      // 创建代理中间件
      const proxy = createProxyMiddleware({
        changeOrigin: options.changeOrigin ?? true,
        secure: options.secure ?? false,
        pathRewrite: Object.keys(pathRewrite).length > 0 ? pathRewrite : undefined,
        ...proxyOptions,
        // 关键设置：禁止自动结束响应
        selfHandleResponse: true, // 禁用默认的响应处理，由我们自己处理
        on: {
          error: (err, req, res) => {
            logger.error(`代理错误: ${req.method} ${req.url}`, { error: err.message });
            // 尝试处理错误
            try {
              // 使用类型断言确保 TypeScript 知道 res 有 writeHead 方法
              (res as ServerResponse).writeHead(500, {
                'Content-Type': 'application/json'
              });
              res.end(JSON.stringify({ 
                code: -1, 
                message: `代理错误: ${err.message}` 
              }));
            } catch (e) {
              logger.error('处理代理错误时出错', { error: e });
            }
          },
          proxyRes: async (proxyRes, req, res) => {
            const statusCode = proxyRes.statusCode || 404;
            const { codes: checkCodes = [], methods: checkMethods = [] } = statusCheck || {};
            // 记录真实请求地址
            const realLocation = new URL(req.url || '', target);
            const path = realLocation.pathname;
            // 记录代理响应
            logger.debug(`代理响应: ${req.method} ${realLocation.href}, 状态码: ${statusCode}`);
            
            // 判断状态码是否在准备好的范围内
            const needMock = checkCodes.includes(statusCode) && checkMethods.includes(req.method || 'GET')
            const isInclude = isMatchUrl(pluginOptions.include || [], context + path)
            const isExclude = isMatchUrl(pluginOptions.exclude || [], context + path)
            logger.debug(`代理path: ${context + path}, isInclude: ${isInclude}, isExclude: ${isExclude}`, {
              include: pluginOptions.include,
              exclude: pluginOptions.exclude,
            });
            
            if (needMock && isInclude && !isExclude) {
              // 消费原始响应数据，防止内存泄漏
              proxyRes.resume();

              // 开始生成 mock 数据
              logger.debug('开始生成 mock 数据');
              const mcpClient = LangchainClient.getInstance(pluginOptions.mcpServers);
              
              try {
                // 在返回响应前完成异步操作
                let mockData: any;
                const cachedMockData = this.mockDataCache.get(path || '');
                if (cachedMockData) {
                  mockData = cachedMockData;
                } else {
                  mockData = await getMockDataByAi(path || '', mcpClient);
                  mockData && this.mockDataCache.set(path || '', mockData);
                }
                logger.debug('成功生成 mock 数据');
                
                // 使用类型断言确保 TypeScript 知道 res 有 writeHead 方法
                (res as ServerResponse).writeHead(200, {
                  'Content-Type': 'application/json',
                  'X-Mock-Data': 'true' // 标识这是 mock 数据
                });
                res.end(JSON.stringify(mockData));
                logger.debug('成功发送 mock 数据响应');
                return;
              } catch (error) {
                logger.error('生成 mock 数据失败', { error });
              }
            } else {
              // 若正常响应，则删除缓存
              this.mockDataCache.delete(path);
            }
            
            // 对于正常响应，直接透传原始响应
            logger.debug(`透传正常响应: ${req.method} ${realLocation.href}, 状态码: ${statusCode}`);
            
            // 设置基本响应头
            (res as ServerResponse).writeHead(statusCode, proxyRes.headers);
            
            // 流式传输响应体
            proxyRes.pipe(res);
          }
        }
      });

      // 注册中间件
      this.app.use(context, proxy);
      index++;
    };
  }

  /**
   * 启动代理服务器
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      const { port } = this.config.pluginOptions;
      this.server = this.app.listen(port, () => {
        logger.info(`代理服务器已启动: http://localhost:${port}`);
        resolve();
      });
    });
  }

  /**
   * 关闭代理服务器
   */
  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        logger.debug('代理服务器未启动，无需关闭');
        resolve();
        return;
      }

      this.mockDataCache.clear();

      this.server.close((err) => {
        if (err) {
          logger.error('关闭代理服务器失败:', err);
          reject(err);
          return;
        }
        
        this.server = null;
        logger.info('代理服务器已关闭');
        resolve();
      });
    });
  }
}

/**
 * 创建代理服务器实例
 */
export function createProxyServer(
  viteProxyConfig: ProxyConfig,
  targetArr: string[],
  options: VitePluginMockProxyOptions
): ProxyServer {
  options.port = options.port || 7171;
  // 处理状态码检查配置
  const defaultStatusCheck = {
    codes: [404] as number[],
    methods: ['GET'] as string[],
  };
  options.statusCheck = {
    ...defaultStatusCheck,
    ...(options.statusCheck || {}),
  };

  // 创建代理服务器
  return new ProxyServer({
    proxyConfigs: viteProxyConfig,
    targetArr,
    pluginOptions: options,
  });
} 