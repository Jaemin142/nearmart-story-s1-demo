FROM node:24-slim
WORKDIR /app
COPY . .
ENV HOST=0.0.0.0 NODE_ENV=production
EXPOSE 10000
CMD ["node", "dashboard/server.mjs"]
