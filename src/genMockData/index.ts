import type { LangchainClient } from '../mcpClient';
import { logger } from '../utils/logger';

export async function getMockDataByAi(api: string, mcpClient: LangchainClient) {
  const apiResult = await mcpClient.invoke({
    messages: [{ role: "user", content: `请调用API Docs工具查找${api}的接口信息。你有权限直接使用工具，无需描述你要做什么，直接使用工具即可。请在你的回复中使用工具调用格式。` }],
  });
  
  const mockResult = await mcpClient.invoke({
    messages: [{ role: "user", content: `请按照以下接口文档 ${apiResult} 生成可以直接被JSON.parse的mock数据`}],
  });
  try {
    if (mockResult.includes('```json')) {
      const mockData = JSON.parse(mockResult.replace(/```json|```/g, ''));
      return mockData;
    }
    return JSON.parse(mockResult);
  } catch (error) {
    logger.error(`mockData 解析失败: ${error}`);
    return null;
  }
}