# 🚀 Nginx Warden

Comprehensive nginx management with ModSecurity WAF, domain management, SSL certificates, and real-time monitoring.

<a href="https://www.producthunt.com/products/waf-advanced-nginx-management-platform?embed=true&utm_source=badge-featured&utm_medium=badge&utm_source=badge-waf-advanced-nginx-management-platform" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1023177&theme=light&t=1759655841567" alt="Nginx Warden | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>


# Project Goal
This project began as a private service built for a company. Later, my client and I decided to make it open source and free for the community to meet the personal or organizational needs of providing users with an easy way to configure Loadbalancer for server systems with SSL termination, Web Application Firewall, and it should be so easy that even a monkey could do it. This goal remains the same Although there may be advanced options, they are optional and the project should be as simple as possible to minimize the barrier to entry. The software will have all the features of an application for a digital business that is needed in the context of technological development to rapidly develop the system along with ensuring system security.


## 🖥️ Cross-Platform Support

Nginx Warden offers full support for major operating systems: **Windows**, **macOS**, and **Linux**. You can deploy, manage, and use this tool on any platform, ensuring flexibility for individuals and organizations. 

**Download the latest release:**  
[Nginx Warden desktop client releases](https://github.com/boxorandyos/nginx-waf-apps-client/releases)



## ✨ Key Features

- 🔒 **ModSecurity WAF** - OWASP Core Rule Set (CRS) + Custom Rules
- 🌐 **Domain Management** - Load balancing, upstream monitoring, HTTPS backend support
- 🔐 **SSL Certificate Management** - Auto Let's Encrypt + Manual upload
- 👥 **Multi-user Management** - Role-based access control (Admin/Moderator/Viewer)
- 📊 **Real-time Monitoring** - Performance metrics, alerts, system health
- 🛡️ **Access Control Lists (ACL)** - IP whitelist/blacklist, GeoIP, User-Agent filtering
- 📋 **Activity Logging** - Comprehensive audit trail
- 🔔 **Smart Alerts** - Email/Telegram notifications with custom conditions
- 💾 **Database Management** - PostgreSQL with Prisma ORM
- 🎨 **Modern UI** - React + TypeScript + ShadCN UI + Tailwind CSS

## 📦 Quick Start

### Choose the appropriate script:

| Use Case | Script | Description |
|----------|--------|-------------|
| **New Server (Production)** | `./scripts/deploy.sh` | Full installation of Nginx + ModSecurity + Backend + Frontend with systemd services |
| **Development/Testing** | `./scripts/quickstart.sh` | Quick run in dev mode (no Nginx installation, no root required) |
| **Upgrade New Version** | `./scripts/update.sh` | Full update to new version |

| Use Case | Port | Description |
|----------|--------|-------------|
| **Front-end** | 8080 | Nginx Warden web UI. Required |
| **Backend** | 3001 | Nginx Warden API. Required |
| **Website** | 80 | Website needs to be protected |
| **Website** | 443 | Website needs to be protected |


### 🖥️ Production Deployment (New Server)

```bash
# Clone repository
git clone https://github.com/boxorandyos/nginx-warden.git
cd nginx-warden

# Run deployment script (requires root)
bash scripts/deploy.sh
```

### 🖥️ Production Upgrade Deployment (Upgrade New Version for script install)

```bash
# Run Upgrade script (requires root)
cd nginx-warden
git pull
bash scripts/update.sh
```

### 🖥️ Production Deployment (Docker container)

## Environment Setup

Before running the application, you need to set up your environment variables:

1. Copy the example environment file to create your local environment configuration:
   ```bash
   cp .env.example .env
   ```

   Update the following required environment variables in your `.env` file:

      | Variable | Description | Example Value | Required |
      |----------|-------------|---------------|----------|
      | `JWT_ACCESS_SECRET` | Secret key for JWT access tokens | `your-random-secret-key-32-chars` | ✅ Yes |
      | `JWT_REFRESH_SECRET` | Secret key for JWT refresh tokens | `your-random-secret-key-32-chars` | ✅ Yes |
      | `SESSION_SECRET` | Secret key for session management | `your-random-secret-key-32-chars` | ✅ Yes |
      | `VITE_API_URL` | Baked into build; use `auto` — the SPA resolves API host from the browser URL at runtime | `auto` | ✅ Yes |
      | `VITE_API_USE_FIXED` | Set `true` only if the API is on another host; then set `VITE_API_URL` to that API origin | `false` | ⚠️ Optional |
      | `DB_NAME` | PostgreSQL database name | `nginx_warden_db` | ✅ Yes |
      | `DB_USER` | PostgreSQL database user | `postgres` | ✅ Yes |
      | `DB_PASSWORD` | PostgreSQL database password | `postgres` | ✅ Yes |
      | `POSTGRES_INITDB_ARGS` | PostgreSQL initialization arguments | `--encoding=UTF-8 --lc-collate=C --lc-ctype=C` | ⚠️ Optional |
      | `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://YOUR_SERVER_IP:8080,http://localhost:8080` | ✅ Yes |

      **Security Note**: Generate strong random secrets using:
      ```bash
      openssl rand -base64 32
      ```

2. Edit the `.env` file and configure the necessary environment variables according to your local setup.




**Note**: The `.env.example` file serves as a template with all required environment variables. Make sure to update the values in your `.env` file with your actual configuration before starting the application.


```bash
# Clone repository
git clone https://github.com/boxorandyos/nginx-warden.git
cd nginx-warden

# Run script install docker latest version
bash docker/scripts/docker.sh
docker-compose build && docker-compose up -d

```

### 🖥️ Production Upgrade Deployment (Upgrade New Version for docker compose)

**⚠️ Important Notice:**

Currently, automatic upgrades are **not supported** for Docker Compose deployments. You must perform manual upgrades following the steps below.

**Before upgrading, please note:**

- ⏱️ **Downtime Expected**: Your services will be temporarily unavailable during the upgrade process
- 💾 **Backup Required**: Always backup your database and configuration files before upgrading
- 🔧 **Manual Process**: You need to manually pull updates and rebuild containers
- 🚧 **Work in Progress**: Our team is actively developing an automated upgrade tool to make this process safer and easier

**Estimated Downtime:** 5-15 minutes depending on your server specifications.

**You can backup all data then reinstall the system and restore using the tools in the software. Unfortunately we are working on automatic updates in the future but currently we do not support containers if you have a solution you can contribute to us.**

**Coming Soon:** Our team is developing a safe upgrade utility that will:
- ✅ Automated backup before upgrade
- ✅ Zero-downtime rolling updates
- ✅ Automatic rollback on failure
- ✅ Configuration migration assistance

**Need help?** Join our [Telegram Support](https://t.me/boxorandyos) for upgrade assistance.



**Minimum Requirements:**
- Ubuntu/Debian server (22.04+ recommended)
- Root access
- RAM: 2GB+ (4GB+ recommended)
- Storage: 10GB+ free space
- Internet connection

The script will **automatically install everything**:
- ✅ Node.js 20.x (if not present)
- ✅ pnpm 8.15.0 (if not present)
- ✅ Docker + Docker Compose (if not present)
- ✅ PostgreSQL 15 container (auto-generated credentials)
- ✅ Nginx + ModSecurity + OWASP CRS
- ✅ Backend API + Frontend (production build)
- ✅ Systemd services with auto-start
- ✅ CORS configuration with Public IP

**Credentials saved at:** `/root/.nginx-warden-credentials`

### 💻 Development Setup

```bash
# Clone repository
git clone https://github.com/boxorandyos/nginx-warden.git
cd nginx-warden

# Run quick start (no root required)
./scripts/quickstart.sh
```

This will:
- Install dependencies
- Start PostgreSQL in Docker (optional)
- Run database migrations and seeding
- Start backend on http://localhost:3001
- Start frontend on http://localhost:8080 (dev mode)

**Press Ctrl+C to stop all services**

## 🔐 Default Login

```
Username: admin
Password: admin123
```

⚠️ **Change password immediately after first login!**

## 🌐 Access URLs

### Development (quickstart.sh)
- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api-docs
- **Prisma Studio**: http://localhost:5555 (dev only)
- **Health Check**: http://localhost:3001/api/health

### Production (deploy.sh)
- **Frontend**: http://YOUR_IP:8080
- **Backend API**: http://YOUR_IP:3001
- **API Documentation**: http://YOUR_IP:3001/api-docs
- **Health Check**: http://YOUR_IP:3001/api/health

## 📚 Documentation

- [API Documentation](./docs/API.md) - Complete REST API reference
- [OpenAPI Specification](./apps/api/openapi.yaml) - Swagger/OpenAPI 3.0 spec
- [Database Schema](./apps/api/prisma/schema.prisma) - Prisma schema with relationships
- [Installation Scripts](./scripts/) - Automated installation scripts

## 🔌 API Endpoints Overview

### Authentication & Account
- `POST /api/auth/login` - User login with 2FA support
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/account/profile` - Get user profile
- `PUT /api/account/profile` - Update user profile
- `POST /api/account/change-password` - Change password

### Domain Management
- `GET /api/domains` - List all domains
- `POST /api/domains` - Create new domain
- `PUT /api/domains/:id` - Update domain configuration
- `DELETE /api/domains/:id` - Delete domain
- `GET /api/domains/:id/upstreams` - Get domain upstreams
- `POST /api/domains/:id/upstreams` - Add upstream server

### SSL Certificate Management
- `GET /api/ssl/certificates` - List SSL certificates
- `POST /api/ssl/generate` - Generate Let's Encrypt certificate
- `POST /api/ssl/upload` - Upload custom certificate
- `DELETE /api/ssl/:id` - Delete certificate
- `POST /api/ssl/renew` - Renew certificate

### ModSecurity WAF
- `GET /api/modsec/crs-rules` - List OWASP CRS rules
- `PUT /api/modsec/crs-rules/:id` - Toggle CRS rule
- `GET /api/modsec/custom-rules` - List custom rules
- `POST /api/modsec/custom-rules` - Create custom rule
- `PUT /api/modsec/custom-rules/:id` - Update custom rule

### Access Control Lists (ACL)
- `GET /api/acl/rules` - List ACL rules
- `POST /api/acl/rules` - Create ACL rule
- `PUT /api/acl/rules/:id` - Update ACL rule
- `DELETE /api/acl/rules/:id` - Delete ACL rule

### Monitoring & Alerts
- `GET /api/performance/metrics` - Get performance metrics
- `GET /api/alerts/rules` - List alert rules
- `POST /api/alerts/rules` - Create alert rule
- `GET /api/alerts/history` - Alert history
- `POST /api/alerts/acknowledge` - Acknowledge alert

### System Management
- `GET /api/system/status` - System health status
- `POST /api/system/nginx/reload` - Reload Nginx configuration
- `GET /api/logs` - System logs with filtering
- `GET /api/users` - User management (admin only)

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + Vite + TypeScript
- **UI Library**: ShadCN UI + Radix UI Primitives
- **Styling**: Tailwind CSS + CSS Variables
- **State Management**: Zustand + TanStack Query
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod validation
- **Internationalization**: i18next

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js + TypeScript
- **Database ORM**: Prisma
- **Authentication**: JWT + Refresh Tokens + 2FA (TOTP)
- **Validation**: Express Validator
- **Security**: Helmet + CORS + bcrypt
- **Logging**: Winston + Morgan
- **Email**: Nodemailer
- **API Documentation**: OpenAPI/Swagger

### Infrastructure
- **Database**: PostgreSQL 15 (Docker)
- **Web Server**: Nginx + ModSecurity 3.x
- **SSL**: Let's Encrypt (acme.sh) + Manual certificates
- **WAF**: OWASP ModSecurity Core Rule Set (CRS)
- **Containerization**: Docker + Docker Compose
- **Process Management**: systemd (production)

## 🏗️ System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│                 │    │                  │    │                 │
│   Frontend      │◄───┤   Nginx Proxy    │◄───┤   Users/API     │
│   (React SPA)   │    │   + ModSecurity  │    │   Clients       │
│   Port: 8080    │    │   + SSL          │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│                 │    │                  │
│   Backend API   │    │   Upstream       │
│   (Express.js)  │    │   Applications   │
│   Port: 3001    │    │   (HTTP/HTTPS)   │
└─────────────────┘    └──────────────────┘
         │
         ▼
┌─────────────────┐
│                 │
│   PostgreSQL    │
│   Database      │
│   Port: 5432    │
└─────────────────┘
```

## 📊 Database Schema

### Core Models
- **Users**: Multi-role user management (admin/moderator/viewer)
- **Domains**: Domain configuration with upstream management
- **Upstreams**: Backend server configuration with health checks
- **SSL Certificates**: Certificate management with auto-renewal
- **ModSecurity Rules**: CRS rules + custom rules per domain
- **ACL Rules**: Access control with multiple conditions
- **Performance Metrics**: Real-time performance tracking
- **Alert System**: Configurable alerts with multi-channel notifications
- **Activity Logs**: Comprehensive audit trail

## 🔧 Service Management

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

### In-app update (Fleet → Configuration)

Admins can **Download & update** to run `git fetch` / `git pull --ff-only` from `UPDATE_GIT_REMOTE` (default `origin`) and `UPDATE_GIT_BRANCH` (default `main`), then execute `scripts/update.sh`. The backend must run as **root** (same as manual updates). If the repo lives outside the default path, set **`NGINX_WARDEN_ROOT`** on the API. Set **`ENABLE_WEB_SYSTEM_UPDATE=false`** to hide this action. The HTTP call can take many minutes; ensure proxies do not time out early.

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

## 📊 View Logs

### Production Logs
```bash
# Application logs
sudo journalctl -u nginx-warden-backend -f    # Backend logs
sudo journalctl -u nginx-warden-frontend -f   # Frontend logs
tail -f /var/log/nginx-warden-backend.log      # Backend log file
tail -f /var/log/nginx-warden-frontend.log     # Frontend log file

# System logs
docker logs -f nginx-warden-postgres           # Database logs
tail -f /var/log/nginx/access.log           # Nginx access logs
tail -f /var/log/nginx/error.log            # Nginx error logs
tail -f /var/log/modsec_audit.log           # ModSecurity audit logs

# Log rotation and management
sudo logrotate -f /etc/logrotate.d/nginx-warden
ls -la /var/log/nginx-warden-*.log*
```

### Development Logs
```bash
# Real-time logs
tail -f /tmp/backend.log     # Backend development logs
tail -f /tmp/frontend.log    # Frontend development logs

# Application-specific logs
cd apps/api && pnpm dev    # Shows real-time backend logs
cd apps/web && pnpm dev    # Shows real-time frontend logs + HMR

# Database logs
docker logs -f nginx-warden-postgres

# Combined log viewing
multitail /tmp/backend.log /tmp/frontend.log
```

## 🐛 Troubleshooting

### Port Conflicts
```bash
# Check what's using ports
sudo netstat -tulnp | grep :3001    # Backend port
sudo netstat -tulnp | grep :8080    # Frontend port (dev & prod)
sudo netstat -tulnp | grep :5432    # PostgreSQL port

# Kill processes on specific ports
sudo lsof -ti:3001 | xargs kill -9  # Backend
sudo lsof -ti:8080 | xargs kill -9  # Frontend (dev & prod)
sudo lsof -ti:5555 | xargs kill -9  # Prisma Studio

# Alternative method
sudo fuser -k 3001/tcp
sudo fuser -k 8080/tcp
```

### Database Issues
```bash
# Check PostgreSQL container
docker ps | grep postgres
docker container inspect nginx-warden-postgres

# Check database connectivity
cd apps/api
pnpm prisma db push --force-reset  # Reset database
pnpm prisma generate                # Regenerate client
pnpm prisma migrate reset           # Reset migrations

# Check environment variables
cat apps/api/.env | grep DATABASE_URL
cd apps/api && node -e "console.log(process.env.DATABASE_URL)"

# Direct database connection test
docker exec -it nginx-warden-postgres psql -U nginx_warden_user -d nginx_warden_db
```

### Nginx Configuration Issues
```bash
# Test nginx configuration
sudo nginx -t
sudo nginx -T  # Show complete configuration

# Check ModSecurity status
sudo tail -f /var/log/nginx/error.log | grep -i modsec

# Verify SSL certificates
sudo openssl x509 -in /etc/nginx/ssl/domain.crt -text -noout

# Check upstream connectivity
curl -I http://localhost:3001/api/health
```

### Performance Issues
```bash
# Check system resources
htop
df -h
free -h

# Check application memory usage
ps aux | grep node | grep -v grep
docker stats nginx-warden-postgres

# Database performance
docker exec -it nginx-warden-postgres psql -U nginx_warden_user -d nginx_warden_db -c "
SELECT schemaname,tablename,attname,n_distinct,correlation
FROM pg_stats WHERE tablename IN ('domains','users','performance_metrics');
"
```

### Common Error Solutions

**Error: "EADDRINUSE: address already in use"**
```bash
# Find and kill the process
sudo lsof -i :3001
sudo kill -9 <PID>
```

**Error: "Database connection failed"**
```bash
# Restart PostgreSQL container
docker restart nginx-warden-postgres
# Wait 10 seconds for startup
sleep 10
cd apps/api && pnpm dev
```

**Error: "ModSecurity failed to load"**
```bash
# Check ModSecurity installation
nginx -V 2>&1 | grep -o with-compat
ls -la /etc/nginx/modules/
sudo nginx -t
```

**Error: "SSL certificate not found"**
```bash
# Check certificate files
sudo ls -la /etc/nginx/ssl/
# Regenerate certificates
sudo /root/.acme.sh/acme.sh --renew -d yourdomain.com --force
```

## Development Workflow

### Setting up Development Environment
```bash
# 1. Fork and clone repository
git clone https://github.com/boxorandyos/nginx-warden.git
cd nginx-warden

# 2. Install dependencies
pnpm install

# 3. Setup database
docker-compose -f docker-compose.db.yml up -d
cd apps/api
cp .env.example .env          # Configure environment variables
pnpm prisma:migrate        # Run database migrations
pnpm prisma:seed          # Seed initial data

# 4. Start development servers
cd apps/web && pnpm dev    # Frontend (Terminal 1)
cd apps/api && pnpm dev     # Backend (Terminal 2)
```

### Code Quality & Standards
```bash
# Linting and formatting
pnpm lint                  # ESLint check
pnpm lint:fix             # Auto-fix ESLint issues

# Type checking
cd apps/api && npx tsc --noEmit    # TypeScript check
npx tsc --noEmit                  # Frontend TypeScript check

# Database operations
cd apps/api
pnpm prisma:studio        # Database GUI
pnpm prisma:generate      # Regenerate Prisma client
pnpm prisma:migrate       # Create new migration
```

### Testing
```bash
# Unit tests (future implementation)
pnpm test                     # Frontend tests
cd apps/api && pnpm test       # Backend tests

# API testing
curl -X GET http://localhost:3001/api/health
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## 📝 Contributing

1. **Fork the repository**
   ```bash
   git clone https://github.com/YourUsername/nginx-warden.git
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make changes following conventions**
   - Use TypeScript for type safety
   - Follow existing code style
   - Add JSDoc comments for functions
   - Update database schema via Prisma migrations
   - Test API endpoints manually

4. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/amazing-feature
   ```

### Commit Convention
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions/modifications
- `chore:` Build/config changes

## 📄 License

This project is licensed under the **License** - see the [LICENSE](LICENSE) file for details.

## 👥 Support & Community

### Getting Help
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/boxorandyos/nginx-warden/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/boxorandyos/nginx-warden/discussions)
- 📚 **Documentation**: [Project Wiki](https://github.com/boxorandyos/nginx-warden/wiki)
- 💬 **Community**: [Telegram Support](https://t.me/boxorandyos)

### Security Issues
For security vulnerabilities, please email: security@tinyactive.net

### Acknowledgments
- [OWASP ModSecurity Core Rule Set](https://owasp.org/www-project-modsecurity-core-rule-set/)
- [Nginx](https://nginx.org/) & [ModSecurity](https://modsecurity.org/)
- [React](https://reactjs.org/) & [ShadCN UI](https://ui.shadcn.com/)
- [Prisma](https://www.prisma.io/) & [PostgreSQL](https://www.postgresql.org/)

---

**🔥 Made with ❤️ by boxorandyos Team**

⭐ **Star this repository if it helped you!**
