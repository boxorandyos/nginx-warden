# Installation Guide

This comprehensive guide will walk you through installing the Nginx Warden on your system.

## Prerequisites

Before you begin, ensure you have the following:

### System Requirements
- **Operating System**: Ubuntu/Debian (22.04+ recommended)
- **Memory**: 2GB RAM minimum (4GB+ recommended)
- **Storage**: 10GB free space minimum
- **Network**: Internet connection for package downloads and Let's Encrypt certificates
- **Access**: Root/sudo privileges for production installation

### Software Requirements (for manual installation)
- **Node.js**: 18.x or higher
- **pnpm**: 8.15.0 or higher
- **Docker**: Latest version
- **Docker Compose**: Latest version
- **PostgreSQL**: 15+ (if not using Docker)
- **Nginx**: Latest stable version
- **ModSecurity**: 3.x with OWASP CRS

## Installation Methods

Choose the appropriate installation method based on your use case:

| Use Case | Installation Method | Description |
|----------|-------------------|-------------|
| **New Server (Production)** | Automated Script | Full installation with systemd services |
| **Development/Testing** | Quick Start Script | Development mode without root requirements |
| **Manual Setup** | Manual Installation | Step-by-step manual configuration |

---

## Method 1: Automated Production Installation

This method is recommended for new servers and production environments.

### 1. Clone the Repository

```bash
git clone https://github.com/boxorandyos/nginx-warden.git
cd nginx-warden
```

### 2. Run the Deployment Script

```bash
bash scripts/deploy.sh
```

The script will automatically install and configure:
- ✅ Node.js 20.x (if not present)
- ✅ pnpm 8.15.0 (if not present)
- ✅ Docker + Docker Compose (if not present)
- ✅ PostgreSQL 15 container with auto-generated credentials
- ✅ Nginx + ModSecurity + OWASP CRS
- ✅ Backend API + Frontend (production build)
- ✅ Systemd services with auto-start
- ✅ CORS configuration with Public IP

### 3. Access Your Credentials

After installation, credentials are saved at:
```bash
/root/.nginx-warden-credentials
```

### 4. Verify Installation

Once completed, you can access:
- **Frontend**: http://YOUR_IP:8080
- **Backend API**: http://YOUR_IP:3001
- **API Documentation**: http://YOUR_IP:3001/api-docs
- **Health Check**: http://YOUR_IP:3001/api/health

---

## Method 2: Development Quick Start

This method is ideal for development and testing environments.

### 1. Clone the Repository

```bash
git clone https://github.com/boxorandyos/nginx-warden.git
cd nginx-warden
```

### 2. Run the Quick Start Script

```bash
./scripts/quickstart.sh
```

This will:
- Install all dependencies
- Start PostgreSQL in Docker (optional)
- Run database migrations and seeding
- Start backend on http://localhost:3001
- Start frontend on http://localhost:8080 (dev mode)

### 3. Stop Services

Press `Ctrl+C` to stop all services.

---

## Method 3: Manual Installation

This method provides full control over the installation process.

### 1. System Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git build-essential
```

### 2. Install Node.js and pnpm

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm@8.15.0

# Verify installations
node --version
pnpm --version
```

### 3. Install Docker and Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 4. Clone and Setup the Project

```bash
# Clone repository
git clone https://github.com/boxorandyos/nginx-warden.git
cd nginx-warden

# Install dependencies
pnpm install
```

### 5. Database Setup

```bash
# Start PostgreSQL container
docker-compose -f docker-compose.db.yml up -d

# Configure environment
cd apps/api
cp .env.example .env

# Edit .env file with your database settings
nano .env
```

Example `.env` configuration:
```env
# Database
DATABASE_URL="postgresql://nginx_warden_user:your_password@localhost:5432/nginx_warden_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"

# Server
PORT=3001
NODE_ENV=production

# Email (optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

### 6. Database Migration and Seeding

```bash
cd apps/api

# Generate Prisma client
pnpm prisma generate

# Run migrations
pnpm prisma migrate deploy

# Seed initial data
pnpm prisma:seed
```

### 7. Build and Start Applications

```bash
# Build backend
cd apps/api
pnpm build

# Build frontend
cd ../web
pnpm build

# Start production servers
cd ../../
# Backend
cd apps/api && pnpm start &

# Frontend
cd ../web && pnpm preview &
```


## Default Login Credentials

After installation, use these default credentials:

```
Username: admin
Password: admin123
```

⚠️ **Important**: Change the default password immediately after first login!

---

## Post-Installation Configuration

### 1. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 3001/tcp    # Backend API (if needed)
sudo ufw allow 8080/tcp    # Frontend (if not behind proxy)
sudo ufw enable
```


---

## Service Management

### Production (systemd services)

```bash
# PostgreSQL Database
docker start nginx-warden-postgres
docker stop nginx-warden-postgres
docker restart nginx-warden-postgres
docker logs -f nginx-warden-postgres

# Backend API Service
sudo systemctl start nginx-warden-backend
sudo systemctl stop nginx-warden-backend
sudo systemctl restart nginx-warden-backend
sudo systemctl status nginx-warden-backend

# Frontend Service
sudo systemctl start nginx-warden-frontend
sudo systemctl stop nginx-warden-frontend
sudo systemctl restart nginx-warden-frontend
sudo systemctl status nginx-warden-frontend

# Nginx Web Server
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl status nginx
sudo nginx -t  # Test configuration
sudo nginx -s reload  # Reload configuration
```

### Development Environment

```bash
# Start development servers
cd nginx-warden

# Backend (Terminal 1)
cd apps/api && pnpm dev

# Frontend (Terminal 2)
cd apps/web && pnpm dev

# Database operations
cd apps/api
pnpm prisma:studio    # Open Prisma Studio
pnpm prisma:migrate   # Run migrations
pnpm prisma:seed      # Seed database

# Stop services
Ctrl+C  # In each terminal

# Or force kill processes
npx kill-port 3001    # Backend port
npx kill-port 8080    # Frontend port (dev & prod)
npx kill-port 5555    # Prisma Studio port
```

---

## Verification

To verify your installation is working correctly:

### 1. Health Check

```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2025-10-04T09:53:00.000Z"
}
```

### 2. Access the Web Interface

Open your browser and navigate to:
- Development: http://localhost:8080
- Production: http://YOUR_IP:8080



---

## Troubleshooting

If you encounter issues during installation:

1. **Port Conflicts**: Check if ports 3001, 8080, or 5432 are already in use
2. **Permission Issues**: Ensure you have proper sudo/root privileges
3. **Database Connection**: Verify PostgreSQL is running and credentials are correct
4. **Node.js Version**: Ensure you're using Node.js 18.x or higher

For detailed troubleshooting, see the [Troubleshooting Guide](/reference/troubleshooting).

---

## Next Steps

After successful installation:

1. [Configure your first domain](/guide/domains)
2. [Set up SSL certificates](/guide/ssl)
3. [Configure ModSecurity WAF](/guide/modsecurity)
4. [Create additional users](/guide/users)
5. [Set up monitoring and alerts](/guide/performance)