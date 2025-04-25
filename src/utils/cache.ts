import { logger } from './logger';

/**
 * 简单的内存缓存实现
 */
export class MemoryCache<T> {
  private cache: Map<string, { data: T; timestamp: number }> = new Map();
  private readonly ttl: number; // 过期时间（毫秒）

  /**
   * 创建缓存实例
   * @param ttl 缓存过期时间（毫秒），默认30分钟
   */
  constructor(ttl: number = 30 * 60 * 1000) {
    this.ttl = ttl;
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug(`创建缓存实例，过期时间: ${ttl}ms`);
    }
  }

  /**
   * 设置缓存项
   * @param key 缓存键
   * @param data 缓存数据
   */
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
    logger.debug(`缓存数据: ${key}`);
  }

  /**
   * 获取缓存项
   * @param key 缓存键
   * @returns 缓存数据，如果不存在或已过期则返回 null
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    // 如果缓存项不存在
    if (!item) {
      logger.debug(`缓存未命中: ${key}`);
      return null;
    }
    
    // 检查是否过期
    const now = Date.now();
    if (now - item.timestamp > this.ttl) {
      logger.debug(`缓存已过期: ${key}`);
      this.cache.delete(key);
      return null;
    }
    
    logger.debug(`缓存命中: ${key}`);
    return item.data;
  }

  /**
   * 删除缓存项
   * @param key 缓存键
   */
  delete(key: string): void {
    this.cache.delete(key);
    logger.debug(`删除缓存: ${key}`);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    logger.debug('清空所有缓存');
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 清理过期的缓存项
   */
  cleanup(): void {
    const now = Date.now();
    let count = 0;
    
    this.cache.forEach((item, key) => {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
        count++;
      }
    });
    
    if (count > 0) {
      logger.debug(`清理了 ${count} 个过期缓存项`);
    }
  }
}