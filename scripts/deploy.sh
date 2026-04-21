#!/bin/bash

################################################################################
# Nginx Warden - Complete Deployment Script
# Description: Deploy Backend + Frontend + Nginx + ModSecurity
# Version: 2.0.0
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/apps/api"
FRONTEND_DIR="$PROJECT_DIR/apps/web"
LOG_FILE="/var/log/nginx-warden-ui-deploy.log"

# --- Port layout (override when invoking: WARDEN_UI_PORT=9080 WARDEN_API_PORT=3101 ./deploy.sh) ---
# WARDEN_UI_PORT default 8088 avoids clashing with common dev ports.
# WARDEN_DB_HOST_PORT default 15432 avoids conflict with a host PostgreSQL on 5432.
# CrowdSec LAPI (if installed) uses CROWDSEC_LAPI_PORT default 9091 — not 8080 or the Warden UI port.
export WARDEN_API_PORT="${WARDEN_API_PORT:-3001}"
export WARDEN_UI_PORT="${WARDEN_UI_PORT:-8088}"
export WARDEN_DB_HOST_PORT="${WARDEN_DB_HOST_PORT:-15432}"
export CROWDSEC_LAPI_PORT="${CROWDSEC_LAPI_PORT:-9091}"

# Database configuration (secrets generated after apt bootstrap — requires openssl)
DB_CONTAINER_NAME="nginx-warden-postgres"
DB_NAME="nginx_warden_db"
DB_USER="nginx_warden_user"

# Logging
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# HTTPS fetch (curl preferred; wget fallback — minimal images often lack curl until apt runs)
warden_http_get() {
    local url="$1"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL --connect-timeout 10 --max-time 60 "$url" 2>/dev/null || return 1
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- -T 60 "$url" 2>/dev/null || return 1
    else
        return 1
    fi
}

warden_download_to_file() {
    local url="$1" dest="$2"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$url" -o "$dest" || return 1
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "$dest" "$url" || return 1
    else
        return 1
    fi
}

# Check root
if [[ "${EUID}" -ne 0 ]]; then
   error "This script must be run as root (use sudo)"
fi

# Minimal apt bootstrap: tools used by this script and CrowdSec helpers (python3, git for UI updates / keys)
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >> "$LOG_FILE" 2>&1 || true
apt-get install -y --no-install-recommends \
  openssl \
  curl \
  wget \
  ca-certificates \
  python3 \
  git \
  gnupg \
  >> "$LOG_FILE" 2>&1 || error "Failed to install base packages (apt: openssl curl wget ca-certificates python3 git gnupg)"

if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    error "Neither curl nor wget is available after apt install — check apt/network."
fi
hash -r 2>/dev/null || true

DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
JWT_ACCESS_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)
SESSION_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)

log "=================================="
log "Nginx Warden Deployment Started"
log "=================================="

# Persist ports for update.sh and operators (never stores secrets)
mkdir -p /etc/nginx-warden
cat > /etc/nginx-warden/ports.env <<EOF
# Written by deploy.sh — sourced by scripts/update.sh for health checks.
WARDEN_API_PORT=${WARDEN_API_PORT}
WARDEN_UI_PORT=${WARDEN_UI_PORT}
WARDEN_DB_HOST_PORT=${WARDEN_DB_HOST_PORT}
# CrowdSec Local API (install-crowdsec.sh); override: CROWDSEC_LAPI_PORT=9081 ./scripts/deploy.sh
CROWDSEC_LAPI_PORT=${CROWDSEC_LAPI_PORT}
EOF
chmod 644 /etc/nginx-warden/ports.env
log "Port file: /etc/nginx-warden/ports.env (API=${WARDEN_API_PORT} UI=${WARDEN_UI_PORT} DB host=${WARDEN_DB_HOST_PORT} CrowdSec LAPI=${CROWDSEC_LAPI_PORT})"

chmod +x "${PROJECT_DIR}/scripts/"*.sh 2>/dev/null || true

# Step 1: Check Prerequisites
log "Step 1/8: Checking prerequisites..."
log "✓ Base packages (bootstrap): openssl, curl, wget, ca-certificates, python3, git, gnupg"

# Get server public IP
if command -v curl >/dev/null 2>&1; then
    PUBLIC_IP=$(curl -s --connect-timeout 8 --max-time 15 ifconfig.me 2>/dev/null || curl -s --connect-timeout 8 --max-time 15 icanhazip.com 2>/dev/null || curl -s --connect-timeout 8 --max-time 15 ipinfo.io/ip 2>/dev/null || echo "localhost")
elif command -v wget >/dev/null 2>&1; then
    PUBLIC_IP=$(wget -qO- -T 15 "https://ifconfig.me" 2>/dev/null || wget -qO- -T 15 "https://icanhazip.com" 2>/dev/null || wget -qO- -T 15 "https://ipinfo.io/ip" 2>/dev/null || echo "localhost")
else
    PUBLIC_IP="localhost"
fi
log "Detected Public IP: $PUBLIC_IP"

# Check Node.js
if ! command -v node &> /dev/null; then
    warn "Node.js not found. Installing Node.js 20.x..."
    warden_http_get "https://deb.nodesource.com/setup_20.x" | bash - >> "$LOG_FILE" 2>&1 || error "Failed to download Node.js setup script"
    apt-get install -y nodejs >> "$LOG_FILE" 2>&1 || error "Failed to install Node.js"
    log "✓ Node.js $(node -v) installed successfully"
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "${NODE_VERSION}" -lt 18 ]; then
        warn "Node.js version too old ($(node -v)). Upgrading to 20.x..."
        warden_http_get "https://deb.nodesource.com/setup_20.x" | bash - >> "$LOG_FILE" 2>&1
        apt-get install -y nodejs >> "$LOG_FILE" 2>&1 || error "Failed to upgrade Node.js"
        log "✓ Node.js upgraded to $(node -v)"
    else
        log "✓ Node.js $(node -v) detected"
    fi
fi

if ! command -v htpasswd &> /dev/null; then
    warn "htpasswd not found. Installing apache2-utils..."
    apt-get install -y apache2-utils >> "$LOG_FILE" 2>&1 || error "Failed to install apache2-utils"
    log "✓ htpasswd installed successfully"
else
    log "✓ htpasswd $(htpasswd -v 2>&1 | head -n1 | awk '{print $3}') detected"
fi


# Check npm (ensure it's installed)
if ! command -v npm &> /dev/null; then
    warn "npm not found. Installing npm..."
    apt-get install -y npm >> "$LOG_FILE" 2>&1 || error "Failed to install npm"
    log "✓ npm $(npm -v) installed successfully"
else
    log "✓ npm $(npm -v) detected"
fi

# Check pnpm (required for monorepo)
if ! command -v pnpm &> /dev/null; then
    warn "pnpm not found. Installing pnpm..."
    npm install -g pnpm@8.15.0 >> "$LOG_FILE" 2>&1 || error "Failed to install pnpm"
    log "✓ pnpm $(pnpm -v) installed successfully"
else
    PNPM_VERSION=$(pnpm -v | cut -d'.' -f1)
    if [ "${PNPM_VERSION}" -lt 8 ]; then
        warn "pnpm version too old ($(pnpm -v)). Upgrading to 8.15.0..."
        npm install -g pnpm@8.15.0 >> "$LOG_FILE" 2>&1 || error "Failed to upgrade pnpm"
        log "✓ pnpm upgraded to $(pnpm -v)"
    else
        log "✓ pnpm $(pnpm -v) detected"
    fi
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    warn "Docker not found. Installing latest Docker..."
    warden_download_to_file "https://get.docker.com" /tmp/install-docker.sh >> "$LOG_FILE" 2>&1 || error "Failed to download Docker installer (need curl or wget + CA certs)"
    sh /tmp/install-docker.sh >> "$LOG_FILE" 2>&1 || error "Failed to install Docker"
    rm -f /tmp/install-docker.sh
    
    # Start Docker service
    systemctl start docker >> "$LOG_FILE" 2>&1
    systemctl enable docker >> "$LOG_FILE" 2>&1
    
    log "✓ Docker $(docker -v | cut -d',' -f1 | cut -d' ' -f3) installed successfully"
else
    log "✓ Docker $(docker -v | cut -d',' -f1 | cut -d' ' -f3) detected"
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    warn "Docker Compose not found. Installing latest version..."
    
    # Get latest docker compose released tag
    COMPOSE_VERSION=$(warden_http_get "https://api.github.com/repos/docker/compose/releases/latest" | grep 'tag_name' | cut -d\" -f4)
    
    if [ -z "$COMPOSE_VERSION" ]; then
        warn "Failed to get latest version, using v2.24.0"
        COMPOSE_VERSION="v2.24.0"
    fi
    
    # Install docker-compose
    warden_download_to_file "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
        /usr/local/bin/docker-compose >> "$LOG_FILE" 2>&1 || error "Failed to download Docker Compose"
    
    chmod +x /usr/local/bin/docker-compose
    
    # Install bash completion
    warden_download_to_file "https://raw.githubusercontent.com/docker/compose/${COMPOSE_VERSION}/contrib/completion/bash/docker-compose" \
        /etc/bash_completion.d/docker-compose 2>/dev/null || true
    
    log "✓ Docker Compose $(docker-compose -v | cut -d' ' -f4 | tr -d ',') installed successfully"
else
    log "✓ Docker Compose $(docker-compose -v | cut -d' ' -f4 | tr -d ',') detected"
fi

# Use pnpm for monorepo
PKG_MANAGER="pnpm"
log "✓ Package manager: ${PKG_MANAGER}"

# Step 2: Setup PostgreSQL with Docker
log "Step 2/8: Setting up PostgreSQL with Docker..."

# Stop and remove existing container if exists
if docker ps -a | grep -q "${DB_CONTAINER_NAME}"; then
    log "Removing existing PostgreSQL container..."
    docker stop "${DB_CONTAINER_NAME}" 2>/dev/null || true
    docker rm "${DB_CONTAINER_NAME}" 2>/dev/null || true
fi

# Remove old volume to ensure clean installation
if docker volume ls | grep -q nginx-warden-postgres-data; then
    log "Removing old PostgreSQL volume for clean installation..."
    docker volume rm nginx-warden-postgres-data 2>/dev/null || true
fi

# Create Docker network if not exists
if ! docker network ls | grep -q nginx-warden-network; then
    docker network create nginx-warden-network >> "$LOG_FILE" 2>&1
    log "✓ Docker network created"
fi

# Start PostgreSQL container
log "Starting PostgreSQL container..."
docker run -d \
    --name "${DB_CONTAINER_NAME}" \
    --network nginx-warden-network \
    -e POSTGRES_DB="${DB_NAME}" \
    -e POSTGRES_USER="${DB_USER}" \
    -e POSTGRES_PASSWORD="${DB_PASSWORD}" \
    -p 127.0.0.1:"${WARDEN_DB_HOST_PORT}":5432 \
    -v nginx-warden-postgres-data:/var/lib/postgresql/data \
    --restart unless-stopped \
    postgres:15-alpine >> "${LOG_FILE}" 2>&1 || error "Failed to start PostgreSQL container"

# Wait for PostgreSQL to be ready
log "Waiting for PostgreSQL to be ready..."
sleep 5
for i in {1..30}; do
    if docker exec "${DB_CONTAINER_NAME}" pg_isready -U "${DB_USER}" > /dev/null 2>&1; then
        log "✓ PostgreSQL is ready"
        break
    fi
    if [ "${i}" -eq 30 ]; then
        error "PostgreSQL failed to start"
    fi
    sleep 1
done

log "✓ PostgreSQL container started successfully"
log "  • Database: ${DB_NAME}"
log "  • User: ${DB_USER}"
log "  • Host port (localhost): ${WARDEN_DB_HOST_PORT} → container 5432"

# Step 3: Install Nginx + ModSecurity
log "Step 3/8: Installing Nginx + ModSecurity..."

if ! command -v nginx &> /dev/null; then
    info "Nginx not found. Installing..."
    bash "${PROJECT_DIR}/scripts/install-nginx-modsecurity.sh" || error "Failed to install Nginx + ModSecurity"
    log "✓ Nginx + ModSecurity installed"
else
    log "✓ Nginx already installed ($(nginx -v 2>&1 | cut -d'/' -f2))"
fi

# Step 4: Setup Backend
log "Step 4/8: Setting up Backend..."

# Install root dependencies first (for monorepo)
cd "${PROJECT_DIR}"
if [ ! -d "node_modules" ]; then
    log "Installing monorepo dependencies..."
    "${PKG_MANAGER}" install >> "${LOG_FILE}" 2>&1 || error "Failed to install monorepo dependencies"
else
    log "✓ Monorepo dependencies already installed"
fi

cd "${BACKEND_DIR}"

# Create backend .env from .env.example (always create fresh)
log "Creating fresh backend .env from .env.example..."
cat > ".env" <<EOF
# Database Configuration
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${WARDEN_DB_HOST_PORT}/${DB_NAME}?schema=public"

# Monorepo root (systemd WorkingDirectory is apps/api — set for git/update + paths)
NGINX_WARDEN_ROOT="${PROJECT_DIR}"

# Server Configuration
PORT=${WARDEN_API_PORT}
HOST=0.0.0.0
NODE_ENV="production"

# JWT Configuration
JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}"
JWT_ACCESS_EXPIRES_IN=60m
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration (comma-separated origins)
CORS_ORIGIN="http://${PUBLIC_IP}:${WARDEN_UI_PORT},http://localhost:${WARDEN_UI_PORT},http://localhost:5173,http://${PUBLIC_IP},http://localhost"

# Security
BCRYPT_ROUNDS=10

# Session
SESSION_SECRET="${SESSION_SECRET}"

# 2FA
TWO_FACTOR_APP_NAME="Nginx Warden"

# SSL Configuration
SSL_DIR="/etc/nginx/ssl"
ACME_DIR="/var/www/html/.well-known/acme-challenge"

# CrowdSec LAPI (scripts/install-crowdsec.sh binds 127.0.0.1:${CROWDSEC_LAPI_PORT} by default)
# CROWDSEC_LAPI_URL=http://127.0.0.1:${CROWDSEC_LAPI_PORT}
# CROWDSEC_API_KEY=

# SMTP Configuration
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="user@example.com"
SMTP_PASS="change-this-to-random-password"
EOF

log "✅ Created fresh backend .env"

log "✓ Backend .env configured with:"
log "  • Database: PostgreSQL (Docker) localhost:${WARDEN_DB_HOST_PORT}"
log "  • API PORT=${WARDEN_API_PORT} UI PORT=${WARDEN_UI_PORT}"
log "  • CORS: UI on ${WARDEN_UI_PORT}; CrowdSec LAPI install uses port ${CROWDSEC_LAPI_PORT} (see install-crowdsec.sh)"
log "  • JWT Secrets: Generated (64 chars each)"

# Generate Prisma Client
log "Generating Prisma client..."
pnpm prisma:generate >> "$LOG_FILE" 2>&1 || error "Failed to generate Prisma client"

# Run migrations
log "Running database migrations..."
pnpm exec prisma migrate deploy >> "$LOG_FILE" 2>&1 || error "Failed to run migrations"

# Force reseed database after fresh PostgreSQL install
log "Seeding database..."
rm -f .seeded  # Remove marker to force reseed
pnpm prisma:seed >> "$LOG_FILE" 2>&1 || warn "Failed to seed database"
touch .seeded

log "✓ Backend setup completed"

# Step 5: Build Backend
log "Step 5/8: Building Backend..."
cd "${PROJECT_DIR}"
pnpm --filter @nginx-warden/api build >> "${LOG_FILE}" 2>&1 || error "Failed to build backend"
log "✓ Backend built successfully"

# Step 6: Setup Frontend
log "Step 6/8: Setting up Frontend..."

cd "${FRONTEND_DIR}"

# Create frontend .env from .env.example (always create fresh)
log "Creating fresh frontend .env from .env.example..."
cat > ".env" <<EOF
# auto = same hostname as the browser; API port is in backend .env (PORT)
VITE_API_URL=auto
EOF

log "✅ Created fresh frontend .env"

log "✓ Frontend .env: VITE_API_URL=auto (browser uses same hostname; API on port ${WARDEN_API_PORT})"

# Clean previous build
if [ -d "dist" ]; then
    log "Cleaning previous build..."
    rm -rf dist
fi

# Build frontend
log "Building frontend..."
cd "${PROJECT_DIR}"
pnpm --filter @nginx-warden/web build >> "${LOG_FILE}" 2>&1 || error "Failed to build frontend"

# Update CSP in built index.html to use public IP
log "Updating Content Security Policy with public IP..."
sed -i "s|__API_URL__|http://${PUBLIC_IP}:${WARDEN_API_PORT} http://localhost:${WARDEN_API_PORT}|g" "${FRONTEND_DIR}/dist/index.html"
sed -i "s|__WS_URL__|ws://${PUBLIC_IP}:* ws://localhost:*|g" "${FRONTEND_DIR}/dist/index.html"

log "✓ Frontend built successfully"
log "✓ CSP configured for API port ${WARDEN_API_PORT}"

# Step 7: Setup Nginx Configuration
log "Step 7/8: Configuring Nginx..."

# Create required directories
mkdir -p /etc/nginx/ssl
mkdir -p /etc/nginx/conf.d
mkdir -p /etc/nginx/snippets
mkdir -p /var/www/html/.well-known/acme-challenge
chmod -R 755 /var/www/html/.well-known
touch /etc/nginx/conf.d/acl-rules.conf

# Create ACME challenge snippet if not exists
if [ ! -f "/etc/nginx/snippets/acme-challenge.conf" ]; then
    cat > /etc/nginx/snippets/acme-challenge.conf <<'EOF'
# ACME Challenge for Let's Encrypt
location ^~ /.well-known/acme-challenge/ {
    default_type "text/plain";
    root /var/www/html;
    allow all;
}

location = /.well-known/acme-challenge/ {
    return 404;
}
EOF
    log "✓ ACME challenge snippet created"
fi

# Setup systemd services
log "Setting up systemd services..."

# Backend service
cat > /etc/systemd/system/nginx-warden-backend.service <<EOF
[Unit]
Description=Nginx Warden Backend
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=${BACKEND_DIR}
Environment=NODE_ENV=production
ExecStart=$(which node) dist/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/nginx-warden-backend.log
StandardError=append:/var/log/nginx-warden-backend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Frontend service (if using preview mode)
cat > /etc/systemd/system/nginx-warden-frontend.service <<EOF
[Unit]
Description=Nginx Warden Frontend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${FRONTEND_DIR}
Environment=NODE_ENV=production
ExecStart=$(which pnpm) preview --host 0.0.0.0 --port ${WARDEN_UI_PORT}
Restart=always
RestartSec=10
StandardOutput=append:/var/log/nginx-warden-frontend.log
StandardError=append:/var/log/nginx-warden-frontend-error.log

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable services
systemctl enable nginx-warden-backend.service >> "$LOG_FILE" 2>&1
systemctl enable nginx-warden-frontend.service >> "$LOG_FILE" 2>&1

log "✓ Systemd services configured"

# Step 8: Start Services
log "Step 8/8: Starting services..."

# Start backend
systemctl restart nginx-warden-backend.service || error "Failed to start backend service"
sleep 2
if ! systemctl is-active --quiet nginx-warden-backend.service; then
    error "Backend service failed to start. Check logs: journalctl -u nginx-warden-backend.service"
fi
log "✓ Backend service started"

# Start frontend
systemctl restart nginx-warden-frontend.service || error "Failed to start frontend service"
sleep 2
if ! systemctl is-active --quiet nginx-warden-frontend.service; then
    error "Frontend service failed to start. Check logs: journalctl -u nginx-warden-frontend.service"
fi
log "✓ Frontend service started"

# Ensure nginx is running
if ! systemctl is-active --quiet nginx; then
    # Fix IPv6 issue if present
    if nginx -t 2>&1 | grep -q "Address family not supported"; then
        log "Fixing IPv6 configuration..."
        sed -i 's/listen \[::\]:80/# listen [::]:80/g' /etc/nginx/sites-available/default 2>/dev/null || true
        sed -i 's/listen \[::\]:443/# listen [::]:443/g' /etc/nginx/sites-available/default 2>/dev/null || true
        sed -i 's/listen \[::\]:80/# listen [::]:80/g' /etc/nginx/sites-enabled/*.conf 2>/dev/null || true
        sed -i 's/listen \[::\]:443/# listen [::]:443/g' /etc/nginx/sites-enabled/*.conf 2>/dev/null || true
    fi
    
    systemctl start nginx || error "Failed to start nginx"
fi
# Configure Nginx
log "Configuring Nginx with custom settings..."
cd "${PROJECT_DIR}"

# Check if custom config exists
if [ ! -f "config/nginx.conf" ]; then
    error "Custom Nginx configuration not found at ${PROJECT_DIR}/config/nginx.conf"
fi

# Create backup with timestamp
BACKUP_FILE="/etc/nginx/nginx.conf.bak-$(date +%Y%m%d%H%M%S)"
if ! cp -f /etc/nginx/nginx.conf "${BACKUP_FILE}" 2>/dev/null; then
    warn "Failed to create backup of original Nginx config"
else
    log "Created backup of original config at ${BACKUP_FILE}"
fi

# Copy custom config
if ! cp -f config/nginx.conf /etc/nginx/nginx.conf; then
    error "Failed to copy custom Nginx configuration"
fi

# Test nginx configuration
if nginx -t >> "$LOG_FILE" 2>&1; then
    log "✓ Nginx configuration test passed"
    
    # Reload nginx to apply changes
    if systemctl reload nginx >> "$LOG_FILE" 2>&1; then
        log "✓ Nginx configuration reloaded successfully"
    else
        warn "Failed to reload Nginx, attempting restart"
        systemctl restart nginx >> "$LOG_FILE" 2>&1
    fi
else
    warn "Nginx configuration test failed, reverting to backup"
    cp -f "${BACKUP_FILE}" /etc/nginx/nginx.conf
    
    # Log the specific error for troubleshooting
    echo -e "${RED}Nginx configuration error:${NC}" | tee -a "$LOG_FILE"
    nginx -t 2>&1 | tee -a "$LOG_FILE"
    
    warn "Reverted to original configuration"
fi

log "✓ Nginx running"

# Final Summary
log ""
log "=================================="
log "Deployment Completed Successfully!"
log "=================================="
log ""
log "📋 Service Status:"
log "  • PostgreSQL: Docker container '${DB_CONTAINER_NAME}'"
log "  • Backend API: http://${PUBLIC_IP}:${WARDEN_API_PORT}"
log "  • Frontend UI: http://${PUBLIC_IP}:${WARDEN_UI_PORT}"
log "  • Nginx: Port 80/443"
log ""
log "🔐 Database Credentials:"
log "  • Host: localhost"
log "  • Port (host): ${WARDEN_DB_HOST_PORT}"
log "  • Database: ${DB_NAME}"
log "  • Username: ${DB_USER}"
log "  • Password: ${DB_PASSWORD}"
log ""
log "🔑 Security Keys:"
log "  • JWT Access Secret: ${JWT_ACCESS_SECRET}"
log "  • JWT Refresh Secret: ${JWT_REFRESH_SECRET}"
log "  • Session Secret: ${SESSION_SECRET}"
log ""
log "📝 Manage Services:"
log "  PostgreSQL: docker start|stop|restart ${DB_CONTAINER_NAME}"
log "  Backend:    systemctl {start|stop|restart|status} nginx-warden-backend"
log "  Frontend:   systemctl {start|stop|restart|status} nginx-warden-frontend"
log "  Nginx:      systemctl {start|stop|restart|status} nginx"
log ""
log "📊 View Logs:"
log "  PostgreSQL: docker logs -f ${DB_CONTAINER_NAME}"
log "  Backend:    tail -f /var/log/nginx-warden-backend.log"
log "  Frontend:   tail -f /var/log/nginx-warden-frontend.log"
log "  Nginx:      tail -f /var/log/nginx/error.log"
log ""
log "🔐 Default Credentials:"
log "  Username: admin"
log "  Password: admin123"
log ""
log "🌐 Access the portal at: http://${PUBLIC_IP}:${WARDEN_UI_PORT}"
log ""

# Save credentials to file
cat > /root/.nginx-warden-credentials <<EOF
# Nginx Warden - Deployment Credentials
# Generated: $(date)

## Public Access
Frontend: http://${PUBLIC_IP}:${WARDEN_UI_PORT}
Backend:  http://${PUBLIC_IP}:${WARDEN_API_PORT}

## Database (Docker)
Container: ${DB_CONTAINER_NAME}
Host: localhost
Port (host): ${WARDEN_DB_HOST_PORT}
Database: ${DB_NAME}
Username: ${DB_USER}
Password: ${DB_PASSWORD}

## Security Keys
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
SESSION_SECRET=${SESSION_SECRET}

## Default Login
Username: admin
Password: admin123

## Docker Commands
Start:   docker start ${DB_CONTAINER_NAME}
Stop:    docker stop ${DB_CONTAINER_NAME}
Logs:    docker logs -f ${DB_CONTAINER_NAME}
Connect: docker exec -it ${DB_CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME}
EOF

chmod 600 /root/.nginx-warden-credentials
log "💾 Credentials saved to: /root/.nginx-warden-credentials"

# CrowdSec Security Engine + nftables firewall bouncer + LAPI keys in apps/api/.env (fully automated)
# Skip with: WARDEN_SKIP_CROWDSEC=1 sudo bash scripts/deploy.sh
if [ "${WARDEN_SKIP_CROWDSEC:-0}" != "1" ]; then
    log "Installing CrowdSec (scripts/install-crowdsec.sh; set WARDEN_SKIP_CROWDSEC=1 to skip)..."
    export CROWDSEC_LAPI_PORT
    if bash "${PROJECT_DIR}/scripts/install-crowdsec.sh" >> "$LOG_FILE" 2>&1; then
        log "CrowdSec: creating bouncer keys and updating apps/api/.env (scripts/crowdsec-autoconfigure.sh)..."
        export BACKEND_DIR PROJECT_DIR CROWDSEC_LAPI_PORT
        bash "${PROJECT_DIR}/scripts/crowdsec-autoconfigure.sh" >> "$LOG_FILE" 2>&1 || warn "CrowdSec autoconfigure failed (see ${LOG_FILE}) — check cscli / LAPI on 127.0.0.1:${CROWDSEC_LAPI_PORT}"
    else
        warn "CrowdSec install failed (see ${LOG_FILE}) — fix apt/network or run WARDEN_SKIP_CROWDSEC=1 and install later"
    fi
else
    log "Skipped CrowdSec (WARDEN_SKIP_CROWDSEC=1)"
fi

# Health check
sleep 3
if curl -fsS --connect-timeout 5 --max-time 15 "http://localhost:${WARDEN_API_PORT}/api/health" | grep -q "success"; then
    log "✅ Backend health check: PASSED"
else
    warn "⚠️  Backend health check: FAILED (may need a moment to start)"
fi

if curl -fsS --connect-timeout 5 --max-time 15 "http://localhost:${WARDEN_UI_PORT}" | grep -q "<!doctype html"; then
    log "✅ Frontend health check: PASSED"
else
    warn "⚠️  Frontend health check: FAILED (may need a moment to start)"
fi

log ""
log "Deployment log saved to: ${LOG_FILE}"
log "=================================="