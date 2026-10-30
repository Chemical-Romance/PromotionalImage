import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';

// 读取 server/.env 里的 AI 配置（和生产环境同源，避免本地/线上配置漂移）
dotenv.config({ path: path.resolve(__dirname, 'server', '.env') });

const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

// 有 API Key 就直转 LLM 提供商（本地一个进程搞定，不需要额外 AI 代理）
// 没 Key 才回退到 localhost:3100
const devDirect = Boolean(AI_API_KEY);

export default defineConfig({
  plugins: [react()],
  define: {
    // 暴露给前端：请求体必须带 model 字段，由 .env 配置
    'import.meta.env.VITE_AI_MODEL': JSON.stringify(AI_MODEL),
  },
  server: {
    port: 8083,
    strictPort: true,
    open: false,
    proxy: devDirect
      ? {
          '/api/ai': {
            target: AI_BASE_URL,
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/api\/ai/, ''),
            headers: {
              Authorization: `Bearer ${AI_API_KEY}`,
            },
          },
        }
      : {
          '/api/ai': {
            target: 'http://localhost:3100',
            changeOrigin: true,
          },
        },
  },
});
