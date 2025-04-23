import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'vite',
  ],
  noExternal: [
    '@langchain/core',
    '@langchain/langgraph',
    '@langchain/mcp-adapters',
    '@langchain/openai',
    'connect',
    'express',
    'http-proxy',
    'http-proxy-middleware',
    'winston',
  ],
  treeshake: true,
  minify: true,
  target: 'node14',
  banner: {
    js: '/**\n * vite-plugin-mock-proxy\n * Vite插件，提供接口请求拦截和状态码检查功能\n * @license ISC\n */',
  },
}); 