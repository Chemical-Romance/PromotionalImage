// promotional-image —— AI 代理服务
// 轻量 Node/Express 代理：前端请求 /api/ai/chat，
// 代理把真正的 API Key 注入 Authorization header 后转发到 LLM 提供商。
// 这样 API Key 只存在服务器 .env 里，永远不暴露到浏览器。

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.AI_PROXY_PORT || 3100;

// 允许跨域（生产环境 Nginx 反代后其实不需要，但开发时方便）
app.use(cors());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// ---- 核心：AI 代理 ----
// 所有 /api/ai/* 的请求都被转发到真正的 LLM 提供商。
// 前端只需请求 /api/ai/chat/completions，代理自动注入 Bearer token。

const AI_BASE_URL = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

if (!AI_API_KEY) {
  console.warn('[ai-proxy] ⚠️  AI_API_KEY 未配置，代理将返回 401');
}

console.log(`[ai-proxy] AI_BASE_URL = ${AI_BASE_URL}`);
console.log(`[ai-proxy] AI_MODEL    = ${AI_MODEL}`);

const aiProxy = createProxyMiddleware({
  target: AI_BASE_URL,
  changeOrigin: true,
  pathRewrite: {
    // /api/ai/chat/completions → /chat/completions
    '^/api/ai': '',
  },
  onProxyReq: (proxyReq, req) => {
    // 注入 Authorization header
    if (AI_API_KEY) {
      proxyReq.setHeader('Authorization', `Bearer ${AI_API_KEY}`);
    }
    proxyReq.setHeader('Content-Type', 'application/json');

    // 如果前端没传 model 字段，用 .env 里的默认值补上
    if (req.body && typeof req.body === 'object' && !req.body.model) {
      const bodyStr = JSON.stringify({ ...req.body, model: AI_MODEL });
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyStr));
      proxyReq.write(bodyStr);
    }
  },
  onProxyRes: (proxyRes) => {
    // 让流式响应也能正常工作
    proxyRes.headers['cache-control'] = 'no-cache';
  },
  onError: (err, req, res) => {
    console.error('[ai-proxy] 转发失败:', err.message);
    res.status(502).json({ error: { message: `AI 代理错误: ${err.message}` } });
  },
});

app.use('/api/ai', aiProxy);

// 兜底
app.use((req, res) => {
  res.status(404).json({ error: 'not found' });
});

app.listen(PORT, () => {
  console.log(`[ai-proxy] listening on :${PORT}`);
});
