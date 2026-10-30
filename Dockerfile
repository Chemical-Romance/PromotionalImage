# PromoStudio —— 生产 Dockerfile
# 纯静态 SPA：多阶段构建，只有 Nginx 运行进最终镜像，体积 ~20MB。
# 构建上下文在项目根目录（dist/ 由 release.sh 本地先 build 好再传上来）。

# ---- Stage 1: 用官方 Nginx 镜像 + 我们的 SPA 配置 ----
FROM nginx:1.27-alpine

# 覆写默认配置，加入 SPA 路由 fallback
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# 把本地 build 好的产物塞进站点根
COPY dist/ /usr/share/nginx/html/

# Nginx 默认暴露 80，容器启动即可
EXPOSE 80

# 健康检查：容器内直接 curl 本地
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
