import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config } from './config';
import routes from './routes';
import { errorHandler, notFound } from './middleware/errorHandler';
import logger from './utils/logger';
import { getMergedCorsOrigins, loadPortalCorsFromDatabase } from './domains/system/portal-access-sync.service';
import { initializeNginxForSSL } from './utils/nginx-setup';
import { modSecSetupService } from './domains/modsec/services/modsec-setup.service';
import { startAlertMonitoring, stopAlertMonitoring } from './domains/alerts/services/alert-monitoring.service';
import { startSlaveNodeStatusCheck, stopSlaveNodeStatusCheck } from './domains/cluster/services/slave-status-checker.service';
import { backupSchedulerService } from './domains/backup/services/backup-scheduler.service';
import { sslSchedulerService } from './domains/ssl/services/ssl-scheduler.service';

const app: Application = express();
let server: ReturnType<Application['listen']> | null = null;
let monitoringTimer: NodeJS.Timeout | null = null;
let slaveStatusTimer: NodeJS.Timeout | null = null;
let backupSchedulerTimer: NodeJS.Timeout | null = null;
let sslSchedulerTimer: NodeJS.Timeout | null = null;

// Security middleware
// app.use(helmet());

// CORS — env origins plus portal access URLs from database (see Configuration page)
app.use(cors({
  origin: (requestOrigin, callback) => {
    const allowList = getMergedCorsOrigins();
    if (!requestOrigin) {
      callback(null, true);
      return;
    }
    if (allowList.includes(requestOrigin)) {
      callback(null, requestOrigin);
      return;
    }
    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  credentials: true,
}));
// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Routes
app.use('/api', routes);

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = config.port;

// Initialize nginx configuration for SSL/ACME
initializeNginxForSSL().catch((error) => {
  logger.warn(`Failed to initialize nginx for SSL: ${error.message}`);
  logger.warn('SSL features may not work properly. Please ensure nginx is installed and you have proper permissions.');
});

// Initialize ModSecurity configuration for CRS management
modSecSetupService.initializeModSecurityConfig().catch((error) => {
  logger.warn(`Failed to initialize ModSecurity config: ${error.message}`);
  logger.warn('CRS rule management features may not work properly.');
});

async function startServer(): Promise<void> {
  await loadPortalCorsFromDatabase();

  server = app.listen(PORT, config.host, async () => {
    logger.info(
      `🚀 Server listening on http://${config.host}:${PORT} (${config.nodeEnv})`
    );
    logger.info(`📡 CORS allow list: ${getMergedCorsOrigins().join(', ')}`);
  
  // Start alert monitoring service (global scan every 10 seconds)
  // Each rule has its own checkInterval for when to actually check
  monitoringTimer = startAlertMonitoring(10);
  
  // Start slave node status checker (check every minute)
  slaveStatusTimer = startSlaveNodeStatusCheck();
  
  // Initialize and start backup scheduler (check every minute)
  try {
    await backupSchedulerService.initializeSchedules();
    backupSchedulerTimer = backupSchedulerService.start(60000);
    logger.info('📦 Backup scheduler initialized and started');
  } catch (error) {
    logger.error('Failed to start backup scheduler:', error);
  }
  
  // Start SSL auto-renew scheduler (check every hour, renew if expires in 30 days)
  try {
    sslSchedulerTimer = sslSchedulerService.start(3600000, 30);
    logger.info('🔒 SSL auto-renew scheduler started');
  } catch (error) {
    logger.error('Failed to start SSL auto-renew scheduler:', error);
  }
  });
}

startServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  if (monitoringTimer) {
    stopAlertMonitoring(monitoringTimer);
  }
  if (slaveStatusTimer) {
    stopSlaveNodeStatusCheck(slaveStatusTimer);
  }
  if (backupSchedulerTimer) {
    backupSchedulerService.stop(backupSchedulerTimer);
  }
  if (sslSchedulerTimer) {
    sslSchedulerService.stop(sslSchedulerTimer);
  }
  server?.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  if (monitoringTimer) {
    stopAlertMonitoring(monitoringTimer);
  }
  if (slaveStatusTimer) {
    stopSlaveNodeStatusCheck(slaveStatusTimer);
  }
  if (backupSchedulerTimer) {
    backupSchedulerService.stop(backupSchedulerTimer);
  }
  if (sslSchedulerTimer) {
    sslSchedulerService.stop(sslSchedulerTimer);
  }
  server?.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default app;
