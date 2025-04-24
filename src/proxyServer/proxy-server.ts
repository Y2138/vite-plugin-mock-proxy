import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Server, ServerResponse } from 'http';
import { VitePluginMockProxyOptions } from '../types';
import { logger } from '../utils/logger';
import { getMockDataByAi } from '../genMockData';
import { LangchainClient } from '../mcpClient';
import { MemoryCache } from '../utils/cache';

interface ProxyConfig {
  [key: string]: {
    target: string;
    changeOrigin?: boolean;
    secure?: boolean;
    rewrite?: (path: string) => string;
    [key: string]: any;
  };
}

export interface ProxyServerConfig {
  port: number;
  proxyConfigs: ProxyConfig;
  cacheExpire: number;
  statusCheck: {
    codes: number[];
    methods: string[];
  };
  debug: boolean;
}

export class ProxyServer {
  private app: express.Express;
  private server: Server | null = null;
  private config: ProxyServerConfig;
  private mockDataCache: MemoryCache<any>;

  constructor(config: ProxyServerConfig) {
    this.config = config;
    this.app = express();
    this.mockDataCache = new MemoryCache<any>(config.cacheExpire);
    // 添加简单的请求日志中间件
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      logger.debug(`收到请求 [${req.method}] ${req.url}`, {
        headers: req.headers,
        query: req.query
      });
      
      // 监听响应完成事件
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.debug(`完成响应 [${res.statusCode}] ${req.method} ${req.url} - ${duration}ms`, {
          statusCode: res.statusCode,
          contentType: res.getHeader('content-type')
        });
      });
      
      next();
    });

    // 初始化代理
    this.setupProxy();
  }

  private setupProxy() {
    const { proxyConfigs, statusCheck } = this.config;
    
    // 遍历代理配置
    Object.keys(proxyConfigs).forEach((context) => {
      const options = proxyConfigs[context];
      const { target, rewrite, ...proxyOptions } = options;
      if (process.env.LOG_LEVEL === 'debug') {
        logger.debug(`设置代理路径 ${context} -> ${target}`, { 
          rewrite: rewrite ? true : false,
          options: proxyOptions 
        });
      }
      
      const pathRewrite: Record<string, string> = {};
      if (rewrite) {
        // 构造路径重写规则
        pathRewrite[`^${context}`] = rewrite(context).replace(/^\//, '');
        logger.debug(`配置路径重写规则`, { rule: pathRewrite });
      }

      // 创建代理中间件
      const proxy = createProxyMiddleware({
        target,
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
          proxyReq: (proxyReq, req) => {
            const location = new URL(req.url || '', `http://${req.headers.host}`);
            // 请求目标前记录详情
            logger.debug(`代理请求: ${req.method} ${req.url} -> ${target}`, {
              originalPath: location.href,
              targetPath: proxyReq.host + proxyReq.path
            });
          },
          proxyRes: async (proxyRes, req, res) => {
            const statusCode = proxyRes.statusCode || 404;
            const { codes: checkCodes, methods: checkMethods } = statusCheck;
            const location = new URL(req.url || '', `http://${req.headers.host}`);
            const path = location.pathname;
            
            // 记录代理响应
            logger.debug(`代理响应: ${req.method} ${location.href}, 状态码: ${statusCode}`, {
              headers: proxyRes.headers,
              statusMessage: proxyRes.statusMessage
            });
            
            // 判断状态码是否在准备好的范围内
            const needMock = checkCodes.includes(statusCode) && checkMethods.includes(req.method || 'GET');
            
            if (needMock) {
              logger.info(`拦截非就绪接口: ${req.method} ${location.href}, 原状态码: ${statusCode}`);
              
              // 消费原始响应数据，防止内存泄漏
              proxyRes.resume();

              // 开始生成 mock 数据
              logger.debug('开始生成 mock 数据');
              const mcpClient = LangchainClient.getInstance({ debug: this.config.debug });
              
              try {
                // 在返回响应前完成异步操作
                let mockData;
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
            logger.debug(`透传正常响应: ${req.method} ${req.url}, 状态码: ${statusCode}`);
            
            // 设置基本响应头
            (res as ServerResponse).writeHead(statusCode, proxyRes.headers);
            
            // 流式传输响应体
            proxyRes.pipe(res);
          }
        }
      });

      // 注册中间件
      this.app.use(context, proxy);
    });
  }

  /**
   * 启动代理服务器
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      const { port } = this.config;
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
  viteProxyConfig: Record<string, any>,
  options: VitePluginMockProxyOptions
): ProxyServer {
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug('创建代理服务器', { options });
  }
  
  const {
    port = 7171,
    statusCheck = {},
  } = options;

  // 处理状态码检查配置
  const defaultStatusCheck = {
    codes: [404] as number[],
    methods: ['GET'] as string[],
  };

  const finalStatusCheck = {
    ...defaultStatusCheck,
    ...statusCheck,
  };
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug('代理服务器配置', { 
      port, 
      proxyConfigsCount: Object.keys(viteProxyConfig).length,
      statusCheck: finalStatusCheck 
    });
  }

  // 创建代理服务器
  return new ProxyServer({
    port,
    cacheExpire: options.cacheExpire || 30 * 60 * 1000,
    proxyConfigs: viteProxyConfig,
    statusCheck: finalStatusCheck,
    debug: options.debug || false,
  });
} 