# PromoStudio AI 代理 —— Dockerfile
# 多阶段：npm ci → 仅拷贝 node_modules + index.js，最终镜像 ~180MB

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY index.js ./
EXPOSE 3100
CMD ["node", "index.js"]
