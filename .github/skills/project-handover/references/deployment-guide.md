---
title: "Deployment Guide"
doc_id: "DEPLOY-001"
version: "2.0"
last_updated: "2026-01-22"
owner: "@devops-lead"
audience: ["devops", "developer"]
purpose: "Comprehensive deployment documentation for all supported platforms and environments."
---

# Deployment Guide

### Docker Compose (Full Stack)

```yaml
# docker-compose.yml
services:
  chatweb:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f
title: "Deployment Guide"
doc_id: "DEPLOY-001"
version: "2.0"
last_updated: "2026-01-22"
owner: "@devops-lead"
audience: ["devops", "developer"]
purpose: "部署文檔 — 本項目僅支持使用 docker-compose 進行自托管部署。"

## Docker Compose 部署指南

本項目僅支持使用 `docker-compose` 進行自托管部署。下列內容說明如何準備、部署、監控及回滾服務。

## 快速開始

1. 在項目根目錄建立或複製 `.env`（參見 `environment-variables.md`）
2. 檢查 `docker-compose.yml` 是否存在並包含所需服務
3. 啟動服務：

```bash
docker-compose up -d
```

4. 訪問應用： http://localhost:3000

## 常見操作

### 啟動/停止

```bash
# 啟動
docker-compose up -d

# 查看日誌
docker-compose logs -f

# 停止
docker-compose down
```

### 回滾與升級

```bash
# 查看本地鏡像
docker images aichat

# 停止目前容器
docker stop aichat

# 啟動上一個可用鏡像
docker run -d --name aichat-rollback \
  -p 3000:3000 \
  --env-file .env \
  aichat:previous-tag

# 或者拉取最新鏡像並重啟 compose
docker-compose pull
docker-compose up -d
```

## 健康檢查

- 訪問 `http://localhost:3000` 檢查主頁
- 使用 `docker-compose logs -f` 檢查應用啟動錯誤
- 使用 `docker ps` 和 `docker stats` 檢查容器狀態與資源

## 安全建議

- 強制使用強密碼（環境變量 `CODE`）
- 不要將 API Key 提交到代碼倉庫；使用 `.env` 並加入 `.gitignore`
- 若需密鑰管理，使用 1Password 或 Vault 等安全存儲
- 啟用 HTTPS（透過反向代理或負載均衡器）

## 監控建議

- 簡單狀態檢查：`docker logs`、`docker stats`、`docker-compose ps`
- 進階監控：將應用與主機度量導入 Prometheus + Grafana
- 錯誤/例外：使用 Sentry 或類似服務收集應用錯誤

## 參考

- [docker-compose 官方文檔](https://docs.docker.com/compose/)
- [環境變量參考](./environment-variables.md)
docker-compose down
```

### Docker Compose with Nginx + LiteLLM

The project includes a full-stack configuration with:
- Nginx reverse proxy (ports 80, 443)
- AIChat web application (port 3000)
- LiteLLM proxy (port 4000)
- PostgreSQL database

```bash
# Start full stack
docker-compose up -d

# Scale horizontally
docker-compose up -d --scale chatweb=3
```
