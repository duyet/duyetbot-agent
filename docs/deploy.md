# Deployment Guide

**Related:** [Getting Started](getting-started.md) | [Use Cases](usecases.md) | [Architecture](architecture.md) | [Contributing](contributing.md)

This guide covers deploying the @duyetbot GitHub App to various platforms.

## Prerequisites

1. **GitHub App registered** (see [Register GitHub App](#register-github-app))
2. **Environment variables** configured
3. **Docker** installed (for container deployments)

---

## Register GitHub App

1. Go to https://github.com/settings/apps/new
2. Fill in:
   - **App name**: `duyetbot`
   - **Homepage URL**: Your deployment URL
   - **Webhook URL**: `https://your-domain/webhook`
   - **Webhook secret**: Generate with `openssl rand -hex 32`

3. Set permissions:
   - Issues: Read & Write
   - Pull requests: Read & Write
   - Contents: Read
   - Actions: Read & Write

4. Subscribe to events:
   - Issue comment
   - Issues
   - Pull request
   - Pull request review comment

5. After creation:
   - Note the **App ID**
   - Generate and download **Private Key**
   - Install on your repositories

---

## Environment Variables

```env
# Required
BOT_USERNAME=duyetbot
GITHUB_TOKEN=ghp_xxx              # Or use App installation token
WEBHOOK_SECRET=your_webhook_secret

# Optional
MCP_SERVER_URL=https://memory.duyetbot.workers.dev
MCP_AUTH_TOKEN=xxx
PORT=3001

# For GitHub App authentication
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_INSTALLATION_ID=12345678
```

---

## Deploy to Railway

### Method 1: GitHub Integration

1. Go to [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository
4. Configure:
   - **Root Directory**: `/`
   - **Build Command**: `pnpm install && pnpm run build --filter @duyetbot/github-bot`
   - **Start Command**: `node apps/github-bot/dist/index.js`

5. Add environment variables in Railway dashboard
6. Railway will provide a public URL for your webhook

### Method 2: Docker

1. Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "infrastructure/docker/github-bot.Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

2. Deploy:
```bash
railway up
```

### Cost
- **Hobby**: $5/month (sufficient for most use cases)
- **Pro**: $20/month (more resources)

---

## Deploy to Fly.io

### 1. Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh
```

### 2. Create `fly.toml`

```toml
app = "duyetbot"
primary_region = "sjc"

[build]
  dockerfile = "infrastructure/docker/github-bot.Dockerfile"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[env]
  NODE_ENV = "production"
  PORT = "3001"

[[services]]
  internal_port = 3001
  protocol = "tcp"

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.http_checks]]
    interval = "10s"
    timeout = "2s"
    path = "/health"
```

### 3. Deploy

```bash
# Login
fly auth login

# Launch (first time)
fly launch --no-deploy

# Set secrets
fly secrets set GITHUB_TOKEN=ghp_xxx
fly secrets set WEBHOOK_SECRET=your_secret
fly secrets set BOT_USERNAME=duyetbot

# Deploy
fly deploy

# Check status
fly status
fly logs
```

### Cost
- **Free tier**: 3 shared-cpu-1x VMs
- **Pay as you go**: ~$2-5/month for small apps

---

## Deploy to Render

### 1. Create `render.yaml`

```yaml
services:
  - type: web
    name: duyetbot
    env: docker
    dockerfilePath: ./infrastructure/docker/github-bot.Dockerfile
    healthCheckPath: /health
    envVars:
      - key: BOT_USERNAME
        value: duyetbot
      - key: GITHUB_TOKEN
        sync: false
      - key: WEBHOOK_SECRET
        sync: false
      - key: MCP_SERVER_URL
        sync: false
```

### 2. Deploy

1. Go to [render.com](https://render.com)
2. Click **New** → **Blueprint**
3. Connect your GitHub repo
4. Render will detect `render.yaml`

### Cost
- **Free**: 750 hours/month (spins down after inactivity)
- **Starter**: $7/month (always on)

---

## Deploy to AWS (ECS/Fargate)

### 1. Build and Push to ECR

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build
docker build -f infrastructure/docker/github-bot.Dockerfile -t duyetbot .

# Tag
docker tag duyetbot:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/duyetbot:latest

# Push
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/duyetbot:latest
```

### 2. Create ECS Task Definition

```json
{
  "family": "duyetbot",
  "containerDefinitions": [
    {
      "name": "duyetbot",
      "image": "YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/duyetbot:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "BOT_USERNAME", "value": "duyetbot"}
      ],
      "secrets": [
        {
          "name": "GITHUB_TOKEN",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT:secret:duyetbot/github-token"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/duyetbot",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "256",
  "memory": "512"
}
```

### Cost
- **Fargate**: ~$10-15/month for small workloads

---

## Deploy with Docker Compose

For self-hosted or VPS deployment:

```yaml
# docker-compose.yml
version: '3.8'

services:
  duyetbot:
    build:
      context: .
      dockerfile: infrastructure/docker/github-bot.Dockerfile
    ports:
      - "3001:3001"
    environment:
      - BOT_USERNAME=duyetbot
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}
      - MCP_SERVER_URL=${MCP_SERVER_URL}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Deploy:
```bash
docker-compose up -d
```

---

## Post-Deployment

### 1. Update GitHub App Webhook URL

Go to your GitHub App settings and update:
- **Webhook URL**: `https://your-deployed-url/webhook`

### 2. Test the Webhook

1. Go to GitHub App settings → Advanced → Recent Deliveries
2. Click **Redeliver** on a recent delivery
3. Check your app logs for the webhook

### 3. Test with a Mention

1. Create an issue in an installed repository
2. Comment: `@duyetbot hello`
3. Bot should respond within seconds

---

## Troubleshooting

### Webhook not received
- Check webhook URL is correct and publicly accessible
- Verify webhook secret matches
- Check GitHub App settings → Advanced → Recent Deliveries

### Bot not responding
- Check logs: `fly logs` or `railway logs`
- Verify GITHUB_TOKEN has correct permissions
- Ensure bot is installed on the repository

### Memory/performance issues
- Increase container resources
- Enable auto-scaling if available
- Check for memory leaks in logs

---

## Security Best Practices

1. **Never commit secrets** - Use environment variables or secret managers
2. **Verify webhook signatures** - Already implemented in the bot
3. **Use HTTPS** - All platforms above provide free SSL
4. **Rotate tokens** - Periodically rotate GitHub tokens
5. **Monitor logs** - Set up alerting for errors

---

## Cost Comparison

| Platform | Free Tier | Paid (Small App) | Notes |
|----------|-----------|------------------|-------|
| Railway | No | $5/month | Easy setup |
| Fly.io | 3 VMs | $2-5/month | Good free tier |
| Render | 750 hrs | $7/month | Spins down on free |
| AWS Fargate | No | $10-15/month | Most control |

**Recommendation**: Start with **Fly.io** for the free tier or **Railway** for simplicity.

---

## Next Steps

- [Getting Started](getting-started.md) - Installation and development setup
- [Architecture](architecture.md) - System design and components
- [GitHub Repository](https://github.com/duyet/duyetbot-agent) - Source code
- [Report Issues](https://github.com/duyet/duyetbot-agent/issues) - Bug reports and feature requests
