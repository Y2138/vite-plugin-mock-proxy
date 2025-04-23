import { LangchainClient } from '../mcpClient';
import { logger } from '../utils/logger';

export async function getMockDataByAi(api: string, mcpClient: LangchainClient) {
  const apiResult = await mcpClient.invoke({
    // messages: [{ role: "user", content: `你好` }],
    messages: [{ role: "user", content: `请调用 API docs mcp，查找${api}的接口信息` }],
    debug: true,
  });
  
  const mockResult = await mcpClient.invoke({
    messages: [{ role: "user", content: `请按照以下接口文档 ${apiResult} 生成可以直接被JSON.parse的mock数据`}],
    debug: true,
  });
  try {
    if (mockResult.includes('```json')) {
      const mockData = JSON.parse(mockResult.replace(/```json|```/g, ''));
      return mockData;
    } else {
      return JSON.parse(mockResult);
    }
  } catch (error) {
    logger.error(`mockData 解析失败: ${error}`);
    return null;
  }
}