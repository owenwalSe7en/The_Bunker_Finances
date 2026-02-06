---
title: Self-Hosted Production Deployment via Cloudflare Tunnel
type: feat
date: 2026-02-05
---

# Self-Hosted Production Deployment

Deploy The Bunker Black Book to your Omakub PC as a production server, accessible from anywhere via Cloudflare Tunnel. This plan maximizes laptop-based preparation so you can simply copy files and run commands when you access your PC.

## Overview

**Current State**: App runs locally on laptop (`npm run dev`)
**Target State**: Production app running on Omakub PC, accessible from anywhere via secure Cloudflare Tunnel
**Constraint**: Currently on laptop, limited PC access

**Architecture**:
```
[Laptop] ──────> [Omakub PC] ──────> [Cloudflare Tunnel] ──────> [Internet]
              Docker Container          Zero Trust Auth          Users Anywhere
              Next.js + cloudflared     Free SSL/TLS              Email-based Access
```

## Problem Statement

You want to:
1. Stop running the app locally on your laptop
2. Host it on your Omakub PC as a persistent server
3. Access it from anywhere (not just local network)
4. Do as much setup work as possible from your laptop before accessing the PC
5. Use free tools (Cloudflare Tunnel, no port forwarding, no VPN costs)

**Why This Matters**:
- Single source of truth for poker finance data
- Access from phone, laptop, anywhere with internet
- No need to keep laptop running
- Professional deployment practices
- Free hosting on hardware you already own

## Proposed Solution

### Phase 1: Laptop Preparation (Do Now)
Create all deployment artifacts on laptop:
- Dockerfile with multi-stage build
- docker-compose.yml for app + Cloudflare Tunnel
- systemd service for auto-start on PC boot
- Production environment template
- Setup scripts and documentation

### Phase 2: Cloudflare Configuration (Do Now)
Set up Cloudflare Tunnel and Google OAuth:
- Create Cloudflare Tunnel in dashboard
- Get tunnel token (copy to secure location)
- Configure Google OAuth redirect URLs
- Update Supabase Auth settings

### Phase 3: PC Deployment (When You Access PC)
Copy files and run setup script:
- Transfer deployment package to PC
- Run automated setup script
- Test deployment
- Enable systemd service for persistence

## Technical Approach

### Docker Architecture

**Multi-Stage Build** (optimize for size and security):
1. **Base**: Node.js 20 Alpine Linux (minimal footprint)
2. **Dependencies**: Install production dependencies only
3. **Builder**: Build Next.js with standalone output
4. **Runner**: Minimal runtime image with non-root user

**Benefits**:
- Image size: ~230MB (vs ~890MB without optimization)
- Security: Non-root user, no dev dependencies
- Fast startup: Only necessary files included

### Cloudflare Tunnel Setup

**Why Cloudflare Tunnel over alternatives**:
- ✅ Free forever (no bandwidth limits)
- ✅ No port forwarding needed (secure outbound-only connections)
- ✅ Zero Trust authentication (email-based access control)
- ✅ Free SSL/TLS certificates (automatic)
- ✅ Built-in DDoS protection
- ❌ Requires domain in Cloudflare (free plan works)

**Flow**:
```
User Request → Cloudflare Edge → Tunnel → Docker Container (Port 3000)
```

### Production Configuration

**Next.js Optimizations**:
- Standalone output mode (reduces deployment size)
- Security headers (XSS, CSP, Frame Options)
- Turbopack build (faster builds)
- No telemetry in production

**Environment Variables**:
- Build-time: `NEXT_PUBLIC_*` variables (frozen at build)
- Runtime: Server-side variables (dynamic)

### systemd Integration

**Why systemd**:
- Auto-start on PC boot
- Automatic restart on failure
- Resource limits (prevent runaway processes)
- Unified logging with journald
- Standard Linux service management

## Acceptance Criteria

### Phase 1: Laptop Preparation
- [ ] Create Dockerfile with multi-stage build and non-root user
- [ ] Create docker-compose.yml with app + cloudflared services
- [ ] Create systemd service file for auto-start
- [ ] Create `.env.production.template` with all required variables
- [ ] Create setup script for automated PC deployment
- [ ] Update `next.config.ts` with standalone output + security headers
- [ ] Create `.dockerignore` to exclude unnecessary files
- [ ] Document manual steps in `DEPLOYMENT.md`

### Phase 2: Cloudflare Configuration
- [ ] Create Cloudflare Tunnel in dashboard
- [ ] Copy tunnel token to secure location (password manager)
- [ ] Configure ingress rule for your domain/subdomain
- [ ] Set up Zero Trust access policy (email allowlist)
- [ ] Configure Google OAuth in Google Cloud Console
- [ ] Add production redirect URL to Google OAuth (Supabase callback URL)
- [ ] Update Supabase Auth redirect URLs for production domain

### Phase 3: PC Deployment
- [ ] Transfer deployment package to PC via git pull or USB
- [ ] Run setup script to create directories and copy files
- [ ] Build Docker image on PC
- [ ] Create `.env.production` with actual secrets
- [ ] Test container locally: `docker compose up`
- [ ] Verify app accessible via Cloudflare Tunnel URL
- [ ] Enable systemd service: `sudo systemctl enable bunker-app`
- [ ] Test auto-start: reboot PC and verify service starts
- [ ] Test OAuth flow with Google sign-in
- [ ] Test email allowlist enforcement
- [ ] Verify SSL/TLS certificate (Cloudflare automatic)

### Quality Gates
- [ ] Docker image scanned for vulnerabilities (docker scout)
- [ ] Container runs as non-root user (verified with `docker exec`)
- [ ] No secrets in Docker image layers (verified with `docker history`)
- [ ] Security headers present (verified in browser DevTools)
- [ ] OAuth redirects work correctly
- [ ] App accessible from laptop, phone, other devices
- [ ] Logs accessible via journalctl
- [ ] Service survives PC reboot

## Phase 1: Laptop Preparation Tasks

### Task 1: Update Next.js Configuration

**File**: `next.config.ts`

Add standalone output and security headers:

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Docker deployment

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy.replace(/\n/g, ''),
          },
        ],
      },
    ];
  },
};

const isDev = process.env.NODE_ENV === 'development';

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://*.supabase.co;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;

module.exports = nextConfig;
```

**Why**: Standalone output creates a minimal deployment package. Security headers protect against XSS, clickjacking, and other attacks.

---

### Task 2: Create Dockerfile

**File**: `Dockerfile`

```dockerfile
# syntax=docker.io/docker/dockerfile:1

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on lockfile
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects anonymous telemetry data
# Disable for production
ENV NEXT_TELEMETRY_DISABLED=1

# Build arguments for NEXT_PUBLIC_ variables (frozen at build time)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
CMD ["node", "server.js"]
```

**Why**:
- Multi-stage build reduces final image from ~890MB to ~230MB
- Non-root user improves security
- Alpine Linux minimizes attack surface
- Standalone output includes only necessary files

---

### Task 3: Create .dockerignore

**File**: `.dockerignore`

```
# Dependencies
node_modules
npm-debug.log

# Build output
.next
out

# Git
.git
.gitignore

# Environment files (secrets should not be in image)
.env*
!.env.local.example

# IDE
.vscode
.idea

# OS
.DS_Store
Thumbs.db

# Misc
README.md
docs
*.md
```

**Why**: Exclude unnecessary files from Docker context, speeds up builds and prevents secrets from entering image layers.

---

### Task 4: Create docker-compose.yml

**File**: `docker-compose.yml`

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
        NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL}
    container_name: bunker-app
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - DIRECT_DATABASE_URL=${DIRECT_DATABASE_URL}
      - ALLOWED_EMAILS=${ALLOWED_EMAILS}
    expose:
      - "3000"
    networks:
      - bunker-network
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared-tunnel
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
    networks:
      - bunker-network
    depends_on:
      app:
        condition: service_healthy

networks:
  bunker-network:
    driver: bridge
```

**Why**:
- Isolates app and cloudflared in private network
- Health check ensures app is ready before tunnel connects
- Security options prevent privilege escalation
- Restart policy ensures resilience

---

### Task 5: Create Health Check Endpoint

**File**: `src/app/api/health/route.ts`

```typescript
export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'bunker-black-book'
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
```

**Why**: Docker healthcheck and monitoring tools need an endpoint to verify app is running.

---

### Task 6: Create Environment Template

**File**: `.env.production.template`

```bash
# ==============================================================================
# PRODUCTION ENVIRONMENT VARIABLES
# ==============================================================================
# Copy this file to .env.production and fill in actual values
# NEVER commit .env.production to git (it's in .gitignore)

# ------------------------------------------------------------------------------
# PUBLIC VARIABLES (embedded in client bundle at build time)
# ------------------------------------------------------------------------------
# These are frozen at build time and cannot change without rebuilding
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# ------------------------------------------------------------------------------
# SERVER-SIDE VARIABLES (runtime, not in client bundle)
# ------------------------------------------------------------------------------
# Database connection (use direct connection on free tier, not pooler)
# Format: postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
DATABASE_URL=postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres
DIRECT_DATABASE_URL=postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres

# Access control (comma-separated email addresses)
ALLOWED_EMAILS=your-email@example.com,player1@example.com

# ------------------------------------------------------------------------------
# CLOUDFLARE TUNNEL
# ------------------------------------------------------------------------------
# Get this from Cloudflare dashboard when creating tunnel
TUNNEL_TOKEN=your-cloudflare-tunnel-token-here

# ==============================================================================
# DEPLOYMENT NOTES
# ==============================================================================
# 1. Password format: NO brackets [ ] around password (common mistake)
# 2. Username: Use "postgres" not "postgres.project-ref" for direct connection
# 3. TUNNEL_TOKEN: Keep secret, treat like a password
# 4. Build-time vars: Changing NEXT_PUBLIC_* requires rebuilding Docker image
# 5. Runtime vars: Changing DATABASE_URL or ALLOWED_EMAILS just needs container restart
```

**Why**: Template documents all required variables with clear instructions. Prevents common mistakes documented in CLAUDE.md.

---

### Task 7: Create systemd Service

**File**: `deployment/bunker-app.service`

```ini
[Unit]
Description=Bunker Black Book Next.js Application
Documentation=https://github.com/owenwalSe7en/The_Bunker_Finances
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=forking
WorkingDirectory=/opt/bunker-app
EnvironmentFile=/opt/bunker-app/.env.production

# Start containers
ExecStart=/usr/bin/docker compose up -d

# Stop containers
ExecStop=/usr/bin/docker compose down

# Restart policy
Restart=on-failure
RestartSec=10s

# Resource limits (prevent runaway processes)
MemoryLimit=2G
MemoryHigh=1.5G
CPUQuota=80%

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=bunker-app

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/bunker-app

[Install]
WantedBy=multi-user.target
```

**Why**: systemd ensures app starts on boot, restarts on failure, and provides centralized logging via journalctl.

---

### Task 8: Create Setup Script

**File**: `deployment/setup.sh`

```bash
#!/bin/bash
set -e

echo "========================================"
echo "Bunker Black Book Production Setup"
echo "========================================"
echo ""

# Configuration
APP_DIR="/opt/bunker-app"
SERVICE_FILE="bunker-app.service"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (use sudo)"
  exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "Error: Docker is not installed"
  echo "Install Docker first: https://docs.docker.com/engine/install/ubuntu/"
  exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
  echo "Error: Docker Compose is not available"
  echo "Docker Compose V2 is required (included with Docker Desktop)"
  exit 1
fi

echo "✓ Docker and Docker Compose are installed"
echo ""

# Create app directory
echo "Creating application directory: $APP_DIR"
mkdir -p "$APP_DIR"

# Copy files
echo "Copying application files..."
cp -r . "$APP_DIR/"
cd "$APP_DIR"

# Create .env.production from template if it doesn't exist
if [ ! -f .env.production ]; then
  echo ""
  echo "⚠️  Creating .env.production from template"
  echo "⚠️  YOU MUST EDIT THIS FILE WITH ACTUAL VALUES"
  cp .env.production.template .env.production
  chmod 600 .env.production
  echo ""
  echo "Edit the file now: nano /opt/bunker-app/.env.production"
  echo "Press Enter when done..."
  read -r
fi

# Validate .env.production has no template placeholders
if grep -q "your-project.supabase.co\|your-anon-key-here\|your-cloudflare-tunnel-token" .env.production; then
  echo ""
  echo "❌ Error: .env.production still contains placeholder values"
  echo "Edit the file and replace ALL placeholders with actual values"
  echo "Then run this script again"
  exit 1
fi

echo "✓ Environment variables configured"
echo ""

# Build Docker image
echo "Building Docker image (this may take a few minutes)..."
docker compose build --no-cache

echo "✓ Docker image built"
echo ""

# Install systemd service
echo "Installing systemd service..."
cp "deployment/$SERVICE_FILE" /etc/systemd/system/
systemctl daemon-reload

echo "✓ systemd service installed"
echo ""

# Enable service (auto-start on boot)
echo "Enabling auto-start on boot..."
systemctl enable bunker-app.service

echo "✓ Auto-start enabled"
echo ""

echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Start the service:"
echo "     sudo systemctl start bunker-app"
echo ""
echo "  2. Check status:"
echo "     sudo systemctl status bunker-app"
echo ""
echo "  3. View logs:"
echo "     sudo journalctl -u bunker-app -f"
echo ""
echo "  4. Test in browser:"
echo "     https://yourdomain.com"
echo ""
echo "  5. If changes needed:"
echo "     - Edit: nano /opt/bunker-app/.env.production"
echo "     - Restart: sudo systemctl restart bunker-app"
echo ""
```

**Why**: Automates PC setup to minimize manual steps. Validates environment, checks dependencies, guides user through deployment.

---

### Task 9: Create Deployment Documentation

**File**: `DEPLOYMENT.md`

```markdown
# Deployment Guide

Complete guide for deploying The Bunker Black Book to production on your Omakub PC.

## Prerequisites

- Omakub PC running Ubuntu (or Debian-based distro)
- Docker and Docker Compose installed
- Cloudflare account (free plan works)
- Domain added to Cloudflare
- Google OAuth credentials configured
- Supabase project with database schema deployed

## Architecture

```
[Omakub PC]
├── Docker Container: bunker-app (Next.js, port 3000)
├── Docker Container: cloudflared (Cloudflare Tunnel)
└── systemd Service: bunker-app.service (auto-start on boot)

[Internet Access]
User → Cloudflare Edge → Tunnel → Docker → Next.js App
```

## Phase 1: Cloudflare Tunnel Setup (Do First)

### 1. Create Tunnel in Cloudflare Dashboard

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com)
2. Navigate to **Networks** → **Tunnels**
3. Click **Create a tunnel**
4. Select **Cloudflared**
5. Name: `bunker-finances-tunnel`
6. Click **Save tunnel**
7. **IMPORTANT**: Copy the tunnel token (long string starting with `eyJ...`)
   - Save it securely (password manager)
   - You'll need this for `.env.production`

### 2. Configure Tunnel Route

1. In the tunnel configuration page:
   - **Public Hostname**:
     - Subdomain: `bunker` (or your choice)
     - Domain: Select your domain
     - Path: Leave empty
   - **Service**:
     - Type: HTTP
     - URL: `app:3000` (Docker service name)
2. Click **Save**

Example final URL: `https://bunker.yourdomain.com`

### 3. Configure Zero Trust Access Policy

1. Go to **Access** → **Applications**
2. Click **Add an application**
3. Select **Self-hosted**
4. Fill in:
   - **Application name**: Bunker Black Book
   - **Session duration**: 24 hours (or your preference)
   - **Application domain**: `bunker.yourdomain.com`
5. Click **Next**
6. Create policy:
   - **Policy name**: Email Allowlist
   - **Action**: Allow
   - **Include rule**:
     - Selector: Emails
     - Value: `your-email@example.com` (add all allowed emails)
7. Click **Next**, then **Add application**

**Result**: Only specified emails can access your app. Cloudflare will show a login page before allowing access.

## Phase 2: Google OAuth Configuration (Do First)

### 1. Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create new)
3. Navigate to **APIs & Services** → **Credentials**
4. Create **OAuth 2.0 Client ID** (or edit existing):
   - Application type: Web application
   - Name: Bunker Black Book Production
   - **Authorized redirect URIs**:
     - Add: `https://your-project-ref.supabase.co/auth/v1/callback`
     - **CRITICAL**: Use your ACTUAL Supabase project ref
5. Save and copy:
   - Client ID
   - Client Secret

### 2. Configure Supabase Auth

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project → **Authentication** → **Providers**
3. Enable **Google**:
   - Paste Client ID
   - Paste Client Secret
   - Enabled: YES
4. Go to **Authentication** → **URL Configuration**:
   - **Site URL**: `https://bunker.yourdomain.com`
   - **Redirect URLs** (add these):
     - `https://bunker.yourdomain.com/auth/callback`
     - `http://localhost:3000/auth/callback` (keep for local dev)

## Phase 3: PC Deployment (When You Access PC)

### 1. Transfer Files to PC

**Option A: Git (Recommended)**
```bash
# On PC
cd /tmp
git clone https://github.com/owenwalSe7en/The_Bunker_Finances.git
cd The_Bunker_Finances
git checkout owen-laptop  # or your deployment branch
```

**Option B: USB Drive**
Copy entire project folder to USB, then copy to PC.

### 2. Run Setup Script

```bash
cd /tmp/The_Bunker_Finances
sudo chmod +x deployment/setup.sh
sudo ./deployment/setup.sh
```

The script will:
1. Check Docker installation
2. Create `/opt/bunker-app` directory
3. Copy all files
4. Prompt you to edit `.env.production`
5. Build Docker image
6. Install systemd service
7. Enable auto-start on boot

### 3. Edit Production Environment Variables

When prompted by setup script, edit `.env.production`:

```bash
sudo nano /opt/bunker-app/.env.production
```

Fill in all values (replace ALL placeholders):
- `NEXT_PUBLIC_SUPABASE_URL`: From Supabase dashboard
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: From Supabase dashboard → Settings → API
- `NEXT_PUBLIC_SITE_URL`: Your Cloudflare Tunnel URL (e.g., `https://bunker.yourdomain.com`)
- `DATABASE_URL`: Supabase direct connection string (no brackets around password!)
- `DIRECT_DATABASE_URL`: Same as DATABASE_URL for free tier
- `ALLOWED_EMAILS`: Comma-separated list (e.g., `you@example.com,player@example.com`)
- `TUNNEL_TOKEN`: From Cloudflare Tunnel creation (step 1)

**Common Mistakes** (from CLAUDE.md):
- ❌ Password with brackets: `postgresql://postgres:[password]@...`
- ✅ Password without brackets: `postgresql://postgres:actualpassword123@...`
- ❌ Username: `postgres.projectref`
- ✅ Username: `postgres`

Save and exit: `Ctrl+X`, `Y`, `Enter`

### 4. Start the Service

```bash
sudo systemctl start bunker-app
```

### 5. Verify Deployment

Check service status:
```bash
sudo systemctl status bunker-app
```

Expected output:
```
● bunker-app.service - Bunker Black Book Next.js Application
     Loaded: loaded (/etc/systemd/system/bunker-app.service; enabled)
     Active: active (running) since...
```

Check logs:
```bash
sudo journalctl -u bunker-app -f
```

Expected: No errors, should see "Server listening on http://0.0.0.0:3000"

Check Docker containers:
```bash
docker ps
```

Expected: Two containers running:
- `bunker-app`
- `cloudflared-tunnel`

### 6. Test in Browser

1. Open browser
2. Navigate to: `https://bunker.yourdomain.com`
3. You should see:
   - Cloudflare Zero Trust login page
   - Enter your email (from allowlist)
   - Check email for one-time code
   - Enter code
   - Redirected to app
4. Click **Sign in with Google**
5. Authorize Google account
6. You should see the app dashboard

**If it doesn't work**:
- Check logs: `sudo journalctl -u bunker-app -f`
- Check Cloudflare Tunnel status in dashboard
- Verify `.env.production` has correct values
- Check Google OAuth redirect URIs match exactly

## Ongoing Management

### View Logs
```bash
# Real-time logs
sudo journalctl -u bunker-app -f

# Last 100 lines
sudo journalctl -u bunker-app -n 100

# Since 1 hour ago
sudo journalctl -u bunker-app --since "1 hour ago"

# Docker container logs
docker logs -f bunker-app
```

### Restart Service
```bash
sudo systemctl restart bunker-app
```

### Stop Service
```bash
sudo systemctl stop bunker-app
```

### Update Application

1. Pull latest changes:
```bash
cd /opt/bunker-app
git pull origin owen-laptop
```

2. Rebuild and restart:
```bash
sudo docker compose build --no-cache
sudo systemctl restart bunker-app
```

### Update Environment Variables

1. Edit `.env.production`:
```bash
sudo nano /opt/bunker-app/.env.production
```

2. If you changed `NEXT_PUBLIC_*` variables, rebuild:
```bash
cd /opt/bunker-app
sudo docker compose build --no-cache
sudo systemctl restart bunker-app
```

3. If you only changed server-side variables (DATABASE_URL, ALLOWED_EMAILS), just restart:
```bash
sudo systemctl restart bunker-app
```

### Check Resource Usage
```bash
docker stats
```

### Security Audit Checklist

- [ ] Container runs as non-root: `docker exec bunker-app whoami` (should say "nextjs")
- [ ] No secrets in image: `docker history bunker-app:latest | grep -i secret` (should be empty)
- [ ] Security headers present: Open DevTools → Network → Check response headers
- [ ] HTTPS working: Check browser shows padlock icon
- [ ] Email allowlist enforced: Try accessing with unauthorized email (should be denied)

## Troubleshooting

### Problem: App not accessible via Cloudflare Tunnel

**Check**:
1. Cloudflare Tunnel status: Dashboard should show "Healthy"
2. Container networking: `docker exec cloudflared-tunnel ping app` (should work)
3. Tunnel token: Verify `TUNNEL_TOKEN` in `.env.production` is correct

**Fix**:
```bash
# Restart tunnel
docker restart cloudflared-tunnel

# Check tunnel logs
docker logs cloudflared-tunnel
```

### Problem: OAuth redirect error

**Check**:
1. Google Cloud Console → Authorized redirect URIs includes: `https://your-project.supabase.co/auth/v1/callback`
2. Supabase → Authentication → URL Configuration → Redirect URLs includes: `https://bunker.yourdomain.com/auth/callback`

**Fix**: Update URLs and wait 5 minutes for propagation.

### Problem: Database connection error

**Check**:
1. `.env.production` → `DATABASE_URL` format is correct (no brackets around password)
2. Username is `postgres` not `postgres.projectref`
3. Port is `5432` (direct connection)

**Fix**:
```bash
# Test database connection from container
docker exec bunker-app node -e "const postgres = require('postgres'); const sql = postgres(process.env.DATABASE_URL); sql\`SELECT 1\`.then(console.log).catch(console.error);"
```

### Problem: App starts but crashes immediately

**Check**:
```bash
# View crash logs
sudo journalctl -u bunker-app -n 50

# Check for missing env vars
docker exec bunker-app env | grep NEXT_PUBLIC
```

**Fix**: Verify all required environment variables are set in `.env.production`.

### Problem: Changes not taking effect

**Remember**:
- `NEXT_PUBLIC_*` changes require **rebuild**: `docker compose build --no-cache`
- Server-side changes only require **restart**: `systemctl restart bunker-app`

## Monitoring and Maintenance

### Daily Tasks
- None required (systemd auto-restarts on failure)

### Weekly Tasks
- Check logs for errors: `sudo journalctl -u bunker-app --since "1 week ago" | grep -i error`
- Review Cloudflare Zero Trust audit logs

### Monthly Tasks
- Update Docker images: `docker compose pull && docker compose up -d`
- Review disk usage: `docker system df`
- Clean old images: `docker system prune -a` (careful: removes unused images)

### Backup Strategy

**What to back up**:
- `/opt/bunker-app/.env.production` (contains secrets)
- Database: Supabase provides automatic backups (free tier: 7 days retention)

**How to back up**:
```bash
# Copy .env.production to secure location
sudo cp /opt/bunker-app/.env.production ~/backups/env-production-$(date +%Y%m%d).backup
```

## Cost Breakdown (All Free)

- ✅ Cloudflare Tunnel: Free (unlimited bandwidth)
- ✅ Cloudflare Zero Trust: Free (up to 50 users)
- ✅ Cloudflare DNS & SSL: Free
- ✅ Supabase: Free tier (500MB database, sufficient for this app)
- ✅ Self-hosted PC: No hosting costs (electricity only)

**Total cost: $0/month** (assuming you already own the PC)

## Next Steps After Deployment

1. **Test thoroughly** from multiple devices (laptop, phone)
2. **Add more users** to Cloudflare Zero Trust access policy
3. **Set up monitoring** (optional): Configure systemd email alerts on failure
4. **Document poker rules** in app (if not already done)
5. **Invite players** to use the app

## Support

If issues arise:
1. Check logs: `sudo journalctl -u bunker-app -f`
2. Review this documentation
3. Check CLAUDE.md for known gotchas
4. Consult Cloudflare/Supabase documentation
```

---

## Phase 2: Cloudflare Configuration Tasks

### Task 10: Create Cloudflare Tunnel

**Steps** (from laptop):
1. Go to https://one.dash.cloudflare.com
2. Navigate to Networks → Tunnels
3. Click "Create a tunnel"
4. Select "Cloudflared" connector type
5. Name: `bunker-finances-tunnel`
6. Copy the tunnel token (starts with `eyJ...`)
7. Store securely in password manager
8. Configure public hostname:
   - Subdomain: `bunker` (or your choice)
   - Domain: Your domain in Cloudflare
   - Service: `http://app:3000` (Docker service name)

**Output**: Tunnel token for `.env.production`

---

### Task 11: Configure Zero Trust Access Policy

**Steps** (from laptop):
1. Go to Access → Applications
2. Add application → Self-hosted
3. Application domain: `bunker.yourdomain.com`
4. Create policy:
   - Include rule: Emails
   - Add your email addresses
5. Save application

**Result**: Email-based authentication before accessing app

---

### Task 12: Configure Google OAuth Redirect URLs

**Steps** (from laptop):
1. Google Cloud Console → Credentials
2. Edit OAuth 2.0 Client ID
3. Add authorized redirect URI:
   - `https://your-project-ref.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret

**Then** in Supabase dashboard:
1. Authentication → Providers → Google
2. Paste Client ID and Client Secret
3. Enable provider
4. URL Configuration → Add redirect URL:
   - `https://bunker.yourdomain.com/auth/callback`

---

## Phase 3: PC Deployment Tasks (When You Access PC)

### Task 13: Transfer Deployment Package

**Method A: Git (Recommended)**
```bash
git clone https://github.com/owenwalSe7en/The_Bunker_Finances.git
cd The_Bunker_Finances
git checkout owen-laptop
```

**Method B: USB Drive**
Copy entire project folder to USB, then to PC.

---

### Task 14: Run Setup Script

```bash
cd The_Bunker_Finances
sudo chmod +x deployment/setup.sh
sudo ./deployment/setup.sh
```

Follow prompts to:
1. Edit `.env.production` with actual values
2. Build Docker image
3. Install systemd service

---

### Task 15: Start and Verify Service

```bash
# Start service
sudo systemctl start bunker-app

# Check status
sudo systemctl status bunker-app

# View logs
sudo journalctl -u bunker-app -f

# Test in browser
# Navigate to https://bunker.yourdomain.com
```

---

## Success Metrics

**Technical Success**:
- [ ] Docker image builds successfully (< 250MB)
- [ ] Container runs as non-root user (verified)
- [ ] App accessible via Cloudflare Tunnel URL
- [ ] OAuth flow completes successfully
- [ ] Email allowlist enforces access control
- [ ] Service auto-starts after PC reboot
- [ ] Logs accessible via journalctl

**User Success**:
- [ ] You can access app from laptop
- [ ] You can access app from phone
- [ ] Players can sign in with Google
- [ ] No need to keep laptop running
- [ ] Data persists across restarts

## Dependencies & Risks

### Dependencies
- Cloudflare account with domain (free plan OK)
- Supabase free tier (currently using)
- Google OAuth credentials (already configured locally)
- Omakub PC reachable for initial setup

### Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| PC loses power | App goes down | systemd auto-restarts on boot |
| Internet outage at home | App inaccessible | No mitigation (inherent to self-hosting) |
| Cloudflare Tunnel fails | App inaccessible | Check tunnel health in dashboard, restart container |
| Docker image build fails | Can't deploy | Build on laptop first to test, then transfer image |
| Environment variable typo | App crashes | Template with validation, setup script checks placeholders |
| Google OAuth misconfigured | Can't sign in | Detailed docs with exact URLs needed |

## Future Considerations

**Potential Enhancements** (not in this plan):
1. Automated backups of `.env.production` to encrypted cloud storage
2. Monitoring and alerting (email on service failure)
3. Automatic updates (watchtower for Docker images)
4. Database migrations CI/CD (run drizzle-kit push in pipeline)
5. Staging environment (separate Cloudflare Tunnel + database)

**Scalability** (if needed later):
1. Move to VPS (DigitalOcean, Hetzner) for 99.9% uptime
2. Add Redis for caching
3. Database connection pooling (PgBouncer)
4. Multiple app instances behind load balancer

## References & Research

### Internal Files
- `CLAUDE.md` - Project conventions and known gotchas
- `package.json` - Dependencies and scripts
- `.env.local.example` - Environment variable reference
- `src/middleware.ts` - Auth and session handling
- `src/lib/supabase/middleware.ts` - Email allowlist logic

### External Documentation
- [Next.js Standalone Output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Next.js Docker Example](https://github.com/vercel/next.js/tree/canary/examples/with-docker)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Docker Node.js Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)
- [Supabase Auth Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [systemd Service Guide](https://www.freedesktop.org/software/systemd/man/systemd.service.html)

### Research Findings
- Multi-stage Docker builds reduce image size by ~75%
- Cloudflare Tunnel eliminates need for port forwarding (free)
- Zero Trust access policies provide email-based auth (free for 50 users)
- systemd provides better auto-restart than Docker restart policies alone
- NEXT_PUBLIC_ variables are frozen at build time (can't change at runtime)
- Supabase free tier doesn't support pooler reliably (use direct connection)
