# vite-plugin-mock-proxy

一个用于 Vite 的代理拦截插件，可以检查 API 状态码并决定返回自定义响应。

## 功能特点

- 自动读取 Vite 的代理配置
- 基于状态码拦截 API 请求
- 当 API 状态码不在预期范围内时返回自定义响应
- 保持 Vite 原有的代理功能，如路径重写等

## 安装

```bash
npm install vite-plugin-mock-proxy -D
# 或
yarn add vite-plugin-mock-proxy -D
# 或
pnpm add vite-plugin-mock-proxy -D
```

## 使用方法

在 `vite.config.js` 或 `vite.config.ts` 中添加插件：

```js
// vite.config.js / vite.config.ts
import { defineConfig } from 'vite';
import mockProxy from 'vite-plugin-mock-proxy';

export default defineConfig({
  plugins: [
    mockProxy({
      // 配置选项
      port: 7171, // 代理服务器端口，默认为 7171
      enable: true, // 是否启用插件，默认为 true
      statusCheck: {
        codes: [404], // 需要拦截的状态码 默认 404
        methods: ['GET'], // 需要拦截的方法 默认 GET
      },
      // 环境变量配置（可选）
      env: {
        AI_MODEL: 'your-model-name', // AI 模型名
        AI_SERVICE_URL: 'https://your-ai-service-url', // AI 服务 URL
        OPENAI_API_KEY: 'your-openai-api-key', // OpenAI API 密钥
      },
      // 调试模式（可选）
      debug: false, // 设置为 true 启用调试模式
    }),
  ],
  server: {
    proxy: {
      // 你的原始代理配置会被自动处理
      '/api': {
        target: 'http://localhost:3033',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

## 工作原理

1. 插件会在 Vite 启动时创建一个代理服务器（默认端口 7171）
2. 它会读取 Vite 的代理配置，并把原始代理目标修改为指向插件代理服务器
3. 插件代理服务器接收到请求后，会转发到原始的目标服务器
4. 当原始服务器响应后，插件会检查状态码是否在指定范围内
5. 如果状态码不在范围内，则返回自定义的"接口未准备好"响应
6. 如果状态码在范围内，则透传原始响应

## 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| port | number | 7171 | 代理服务器端口 |
| enable | boolean | true | 是否启用插件 |
| statusCheck.codes | number[] | [404] | 认为接口准备好的状态码范围 |
| statusCheck.methods | string[] | ['GET'] | 认为接口准备好的状态码范围 |
| env | object | {} | 环境变量配置，用于设置插件运行所需的环境变量 |
| env.AI_SERVICE_URL | string | undefined | AI 服务 URL |
| env.OPENAI_API_KEY | string | undefined | OpenAI API 密钥 |
| debug | boolean | false | 是否启用调试模式 |

## 环境变量配置

插件需要一些环境变量来正常工作。你有以下几种方式来提供这些环境变量：

1. **通过插件配置提供**（推荐）：
   ```js
   mockProxy({
     env: {
       AI_MODEL: 'your_model_name',
       AI_SERVICE_URL: 'https://your-ai-service-url',
       OPENAI_API_KEY: 'your-openai-api-key',
     }
   })
   ```

2. **使用 Vite 的环境变量**：
   如果你在 `.env` 文件中定义了以 `VITE_` 开头的环境变量，插件会自动尝试使用它们：
   ```
   # .env 文件
   VITE_AI_MODEL=your_model_name,
   VITE_AI_SERVICE_URL=https://your-ai-service-url
   VITE_OPENAI_API_KEY=your-openai-api-key
   ```
   
3. **直接在环境中设置**：
   你也可以在启动 Vite 开发服务器之前，通过操作系统环境变量或命令行设置：
   ```bash
   export VITE_AI_MODEL=your_model_name,
   export AI_SERVICE_URL=https://your-ai-service-url
   export OPENAI_API_KEY=your-openai-api-key
   npm run dev
   ```

## 调试插件

如果代理服务器无法正常工作，你可以使用以下方法进行调试：

1. **启用调试模式**：
   在插件配置中设置 `debug: true`，这将启用详细的日志输出，帮助你发现问题所在：
   ```js
   mockProxy({
     debug: true,
     // ... 其他配置
   })
   ```

2. **检查日志文件**：
   插件会生成两个日志文件：
   - `mock-proxy.log`：包含所有级别的日志
   - `mock-proxy-error.log`：仅包含错误级别的日志

3. **查看响应头**：
   当接口被拦截并返回模拟数据时，响应头会包含 `X-Mock-Data: true`，
   你可以在浏览器开发者工具中查看这个头信息来确认拦截是否生效。

4. **环境变量检查**：
   确保必要的环境变量已正确设置。你可以临时在 Vite 配置中添加以下代码来打印环境变量：
   ```js
   console.log('环境变量:', {
     AI_SERVICE_URL: process.env.AI_SERVICE_URL,
     OPENAI_API_KEY: process.env.OPENAI_API_KEY,
   });
   ```

## 使用场景

1. 前端开发时需要等待后端服务准备就绪
2. 需要过滤掉特定状态码的响应
3. 需要在特定错误状态下返回自定义响应

## 技术栈和原理

### 核心技术栈

- **TypeScript**: 提供强类型支持，增强代码可维护性和开发体验
- **Vite Plugin**: 作为 Vite 构建工具的插件扩展，无缝集成到现有 Vite 项目
- **Express**: 搭建轻量级代理服务器，处理 HTTP 请求和响应
- **http-proxy-middleware**: 实现高性能的 HTTP 请求代理转发功能
- **LangChain/MCP**: 使用 AI 工具链进行接口文档解析和 Mock 数据生成
- **OpenAI API**: 通过大语言模型生成符合接口规范的 Mock 数据
- **Winston**: 提供灵活的日志系统，支持多级别日志输出和文件持久化

### 核心模块

1. **代理服务器 (ProxyServer)**:
   - 基于 Express 搭建的代理服务器
   - 拦截请求，根据状态码判断是否需要生成 Mock 数据
   - 支持路径重写、请求头修改等高级代理功能

2. **AI 客户端 (LangchainClient)**:
   - 基于单例模式实现的 AI 服务客户端
   - 连接到 MCP (Machine Conversation Protocol) 服务器
   - 使用 React Agent 处理复杂的多步骤任务

3. **Mock 数据生成 (getMockDataByAi)**:
   - 首先查询 API 接口文档信息
   - 基于接口文档生成符合规范的 Mock 数据
   - 支持数据缓存以提高性能

4. **日志系统**:
   - 基于 Winston 实现的多级别日志
   - 支持控制台输出和文件持久化
   - 提供 debug 和 normal 两种运行模式

### 工作流程详解

1. **启动阶段**:
   - 读取插件配置和环境变量
   - 创建独立代理服务器
   - 修改 Vite 原有代理配置，指向插件代理服务器

2. **请求处理阶段**:
   - 接收来自前端的 API 请求
   - 转发请求到实际的后端服务
   - 监听后端服务响应

3. **响应处理阶段**:
   - 检查响应状态码
   - 对于状态码正常的响应，直接透传给前端
   - 对于状态码异常的响应，拦截并生成 Mock 数据:
     1. 调用 MCP 服务获取 API 文档信息
     2. 将 API 文档信息提供给 AI 模型
     3. AI 模型生成符合接口规范的 Mock 数据
     4. 返回生成的数据给前端

4. **缓存机制**:
   - 对生成的 Mock 数据进行缓存
   - 相同 API 的重复请求直接从缓存返回
   - 缓存具有过期时间，保证数据的时效性

### 性能优化

- 使用内存缓存减少重复的 AI 调用
- 实现细粒度的日志级别控制，减少不必要的日志输出
- 采用流式处理响应体，减少内存占用

### 扩展性

该插件设计上支持多种扩展:
- 可自定义状态码判断逻辑
- 可替换不同的 AI 服务提供商
- 可扩展代理服务器功能，如添加身份验证、请求限流等

## 许可证

ISC 