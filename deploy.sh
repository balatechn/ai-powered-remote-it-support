#!/bin/bash
# ============================================================
# NexusIT — Direct VPS Deployment Script
# Run as root on the server: bash deploy.sh
# ============================================================
set -e

REPO_URL="https://github.com/balatechn/ai-powered-remote-it-support.git"
DEPLOY_DIR="/opt/nexusit"
SERVER_IP="187.127.134.246"

echo "============================================"
echo "  NexusIT Direct VPS Deployment"
echo "============================================"

# ── 1. Install dependencies ─────────────────────────────────
echo "[1/6] Checking dependencies..."
if ! command -v docker &>/dev/null; then
  echo "  Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

if ! docker compose version &>/dev/null 2>&1; then
  echo "  Installing Docker Compose plugin..."
  apt-get update -qq && apt-get install -y -qq docker-compose-plugin
fi

if ! command -v git &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq git
fi
echo "  Done."

# ── 2. Free port 80 ─────────────────────────────────────────
echo "[2/6] Freeing port 80..."

# Stop Coolify's Traefik proxy if it's holding port 80
if docker ps --format '{{.Names}}' | grep -q "coolify-proxy"; then
  echo "  Stopping coolify-proxy (Traefik)..."
  docker stop coolify-proxy 2>/dev/null || true
fi

# Stop any Coolify-managed nexusit containers
echo "  Stopping existing nexusit containers..."
docker ps -a --filter "label=coolify.resourceName=nexusit-platform" -q \
  | xargs -r docker rm -f 2>/dev/null || true

# Double-check port 80 is free
if ss -tlnp 2>/dev/null | grep -q ':80 ' || netstat -tlnp 2>/dev/null | grep -q ':80 '; then
  echo "  WARNING: Port 80 still in use. Checking what's on it..."
  ss -tlnp | grep ':80 ' || netstat -tlnp | grep ':80 ' || true
  echo "  Attempting to continue anyway..."
fi
echo "  Done."

# ── 3. Clone or update repository ───────────────────────────
echo "[3/6] Fetching code..."
if [ -d "$DEPLOY_DIR/.git" ]; then
  echo "  Pulling latest from main..."
  cd "$DEPLOY_DIR"
  git fetch origin
  git reset --hard origin/main
else
  echo "  Cloning repository..."
  git clone "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi
echo "  Done. Commit: $(git rev-parse --short HEAD)"

# ── 4. Configure environment ─────────────────────────────────
echo "[4/6] Configuring environment..."
cd "$DEPLOY_DIR"

if [ ! -f .env ]; then
  echo "  Creating .env from template..."
  cp .env.example .env

  # Generate secure random secrets
  DB_PASS=$(openssl rand -hex 20)
  JWT_SEC=$(openssl rand -hex 32)
  JWT_REF=$(openssl rand -hex 32)
  AGT_SEC=$(openssl rand -hex 20)
  ENC_KEY=$(openssl rand -hex 16)

  sed -i "s|NODE_ENV=.*|NODE_ENV=production|"                            .env
  sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=http://${SERVER_IP}|"           .env
  sed -i "s|DB_HOST=localhost|DB_HOST=postgres|"                         .env
  sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=${DB_PASS}|"                      .env
  sed -i "s|REDIS_HOST=localhost|REDIS_HOST=redis|"                      .env
  sed -i "s|your_jwt_secret_here_min_32_chars|${JWT_SEC}|"               .env
  sed -i "s|your_refresh_secret_here_min_32_chars|${JWT_REF}|"           .env
  sed -i "s|your_agent_registration_secret|${AGT_SEC}|"                  .env
  sed -i "s|your_32_char_encryption_key_here|${ENC_KEY}|"                .env
  sed -i "s|SERVER_URL=.*|SERVER_URL=http://${SERVER_IP}/api|"           .env

  echo "  .env created with secure random secrets."
  echo "  >>> Edit OPENAI_API_KEY in /opt/nexusit/.env if needed <<<"
else
  echo "  .env already exists — skipping generation."
  # Make sure production values are set
  sed -i "s|NODE_ENV=development|NODE_ENV=production|"                   .env
  sed -i "s|FRONTEND_URL=http://localhost.*|FRONTEND_URL=http://${SERVER_IP}|" .env
  sed -i "s|DB_HOST=localhost|DB_HOST=postgres|"                         .env
  sed -i "s|REDIS_HOST=localhost|REDIS_HOST=redis|"                      .env
fi
echo "  Done."

# ── 5. Build and start ───────────────────────────────────────
echo "[5/6] Building and starting containers (this takes a few minutes)..."
cd "$DEPLOY_DIR"

# Clean up any stale images from previous deploys to avoid cache issues
docker compose down --remove-orphans 2>/dev/null || true

docker compose up --build -d

echo "  Done."

# ── 6. Open firewall port 80 ─────────────────────────────────
echo "[6/6] Checking firewall..."
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp comment 'NexusIT HTTP' 2>/dev/null && echo "  UFW: port 80 allowed."
fi
if command -v firewall-cmd &>/dev/null; then
  firewall-cmd --permanent --add-port=80/tcp 2>/dev/null && firewall-cmd --reload && echo "  firewalld: port 80 allowed."
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo ""
echo "  App URL  : http://${SERVER_IP}"
echo "  API URL  : http://${SERVER_IP}/api/health"
echo ""
echo "  Container status:"
docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps
echo ""
echo "  Useful commands:"
echo "    View logs   :  docker compose -C $DEPLOY_DIR logs -f"
echo "    Restart     :  docker compose -C $DEPLOY_DIR restart"
echo "    Stop        :  docker compose -C $DEPLOY_DIR down"
echo ""
