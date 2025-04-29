import type { LangchainClient } from '../mcpClient';
import { logger } from '../utils/logger';

export async function getMockDataByAi(api: string, mcpClient: LangchainClient) {
  const apiResult = await mcpClient.invoke({
    messages: [
      { role: "user", content: `请调用API Docs工具查找${api}的接口信息，输出其接口文档` }
    ],
  });
  
  let mockResult = await mcpClient.invoke({
    messages: [{ role: "user", content: `请按照以下接口文档 ${apiResult} 生成mock数据，请直接输出JSON格式`}],
  });
  try {
    if (mockResult.includes('```json')) {
      mockResult = mockResult.match(/```json([\s\S]*)```/g)[0].replace(/```json|```/g, '');
      return JSON.parse(mockResult);
    }
    return JSON.parse(mockResult);
  } catch (error) {
    logger.error(`mockData 解析失败: ${error}`);
    return null;
  }
}