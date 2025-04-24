import winston from 'winston';

// 创建自定义格式化器，包含更多调试信息
const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  // 组合元数据
  let meta = '';
  if (Object.keys(metadata).length > 0) {
    meta = JSON.stringify(metadata, null, 2);
  }
  
  // 返回格式化的日志消息
  return `${timestamp} [${level.toUpperCase()}] 🔌 vite-plugin-mock-proxy: ${message} ${meta}`;
});

const logger = winston.createLogger({
  // 使用环境变量设置日志级别，默认为 info
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    }),
    // 文件日志
    new winston.transports.File({ 
      filename: 'mock-proxy-error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'mock-proxy.log',
      options: { flags: 'w' } // 每次启动覆盖日志文件
    })
  ],
});

// 添加工具方法：启用调试日志
export function enableDebugLogs() {
  logger.level = 'debug';
  logger.debug('调试日志已启用');
}

// 添加工具方法：禁用调试日志
export function disableDebugLogs() {
  logger.level = 'info';
  logger.info('调试日志已禁用，仅显示info级别及以上日志');
}

export { logger }; 