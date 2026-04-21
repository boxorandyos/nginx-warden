import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../../../utils/logger';
import {
  BACKUP_CONSTANTS,
  DomainBackupData,
  SSLBackupData,
  SSLCertificateFiles,
} from '../backup.types';
import { nginxConfigService } from '../../domains/services/nginx-config.service';
import { DomainWithRelations } from '../../domains/domains.types';

const execAsync = promisify(exec);

/**
 * Backup Operations Service
 * Handles file system operations for backups (vhost configs, SSL certs, etc.)
 */
export class BackupOperationsService {
  /**
   * Ensure backup directory exists
   */
  async ensureBackupDir(): Promise<void> {
    try {
      await fs.mkdir(BACKUP_CONSTANTS.BACKUP_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create backup directory:', error);
      throw new Error('Failed to create backup directory');
    }
  }

  /**
   * Reload nginx configuration
   */
  async reloadNginx(): Promise<boolean> {
    try {
      // Test nginx configuration first
      logger.info('Testing nginx configuration...');
      await execAsync('nginx -t');

      // Reload nginx
      logger.info('Reloading nginx...');
      await execAsync('nginx -s reload');

      logger.info('Nginx reloaded successfully');
      return true;
    } catch (error: any) {
      logger.error('Failed to reload nginx:', error);
      logger.error('Nginx test/reload output:', error.stdout || error.stderr);

      // Try alternative reload methods
      try {
        logger.info('Trying alternative reload method...');
        await execAsync('nginx -s reload');
        logger.info('Nginx reloaded successfully (alternative method)');
        return true;
      } catch (altError) {
        logger.error('Alternative reload also failed:', altError);
        return false;
      }
    }
  }

  /**
   * Format bytes to human readable size
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Write backup file to disk
   */
  async writeBackupFile(data: any, filename: string): Promise<string> {
    const filepath = path.join(BACKUP_CONSTANTS.BACKUP_DIR, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    return filepath;
  }

  /**
   * Read nginx vhost configuration file for a domain
   */
  async readNginxVhostConfig(domainName: string) {
    try {
      const vhostPath = path.join(
        BACKUP_CONSTANTS.NGINX_SITES_AVAILABLE,
        `${domainName}.conf`
      );
      const vhostConfig = await fs.readFile(vhostPath, 'utf-8');

      // Check if symlink exists in sites-enabled
      let isEnabled = false;
      try {
        const enabledPath = path.join(
          BACKUP_CONSTANTS.NGINX_SITES_ENABLED,
          `${domainName}.conf`
        );
        await fs.access(enabledPath);
        isEnabled = true;
      } catch {
        isEnabled = false;
      }

      return {
        domainName,
        config: vhostConfig,
        enabled: isEnabled,
      };
    } catch (error) {
      logger.warn(`Nginx vhost config not found for ${domainName}`);
      return null;
    }
  }

  /**
   * Write nginx vhost configuration file for a domain
   */
  async writeNginxVhostConfig(
    domainName: string,
    config: string,
    enabled: boolean = true
  ) {
    try {
      await fs.mkdir(BACKUP_CONSTANTS.NGINX_SITES_AVAILABLE, {
        recursive: true,
      });
      await fs.mkdir(BACKUP_CONSTANTS.NGINX_SITES_ENABLED, { recursive: true });

      const vhostPath = path.join(
        BACKUP_CONSTANTS.NGINX_SITES_AVAILABLE,
        `${domainName}.conf`
      );
      await fs.writeFile(vhostPath, config, 'utf-8');
      logger.info(`Nginx vhost config written for ${domainName}`);

      // Create symlink in sites-enabled if enabled
      if (enabled) {
        const enabledPath = path.join(
          BACKUP_CONSTANTS.NGINX_SITES_ENABLED,
          `${domainName}.conf`
        );
        try {
          await fs.unlink(enabledPath);
        } catch {
          // Ignore if doesn't exist
        }
        await fs.symlink(vhostPath, enabledPath);
        logger.info(`Nginx vhost enabled for ${domainName}`);
      }
    } catch (error) {
      logger.error(`Error writing nginx vhost config for ${domainName}:`, error);
      throw error;
    }
  }

  /**
   * Read SSL certificate files for a domain
   */
  async readSSLCertificateFiles(
    domainName: string
  ): Promise<SSLCertificateFiles> {
    try {
      const certPath = path.join(
        BACKUP_CONSTANTS.SSL_CERTS_PATH,
        `${domainName}.crt`
      );
      const keyPath = path.join(
        BACKUP_CONSTANTS.SSL_CERTS_PATH,
        `${domainName}.key`
      );
      const chainPath = path.join(
        BACKUP_CONSTANTS.SSL_CERTS_PATH,
        `${domainName}.chain.crt`
      );

      const sslFiles: SSLCertificateFiles = {};

      // Try to read certificate file
      try {
        sslFiles.certificate = await fs.readFile(certPath, 'utf-8');
      } catch (error) {
        logger.warn(`SSL certificate not found for ${domainName}: ${certPath}`);
      }

      // Try to read private key file
      try {
        sslFiles.privateKey = await fs.readFile(keyPath, 'utf-8');
      } catch (error) {
        logger.warn(`SSL private key not found for ${domainName}: ${keyPath}`);
      }

      // Try to read chain file (optional)
      try {
        sslFiles.chain = await fs.readFile(chainPath, 'utf-8');
      } catch (error) {
        // Chain is optional, don't log warning
      }

      return sslFiles;
    } catch (error) {
      logger.error(`Error reading SSL files for ${domainName}:`, error);
      return {};
    }
  }

  /**
   * Write SSL certificate files for a domain
   */
  async writeSSLCertificateFiles(
    domainName: string,
    sslFiles: SSLCertificateFiles
  ) {
    try {
      await fs.mkdir(BACKUP_CONSTANTS.SSL_CERTS_PATH, { recursive: true });

      if (sslFiles.certificate) {
        const certPath = path.join(
          BACKUP_CONSTANTS.SSL_CERTS_PATH,
          `${domainName}.crt`
        );
        await fs.writeFile(certPath, sslFiles.certificate, 'utf-8');
        logger.info(`SSL certificate written for ${domainName}`);
      }

      if (sslFiles.privateKey) {
        const keyPath = path.join(
          BACKUP_CONSTANTS.SSL_CERTS_PATH,
          `${domainName}.key`
        );
        await fs.writeFile(keyPath, sslFiles.privateKey, 'utf-8');
        // Set proper permissions for private key
        await fs.chmod(keyPath, 0o600);
        logger.info(`SSL private key written for ${domainName}`);
      }

      if (sslFiles.chain) {
        const chainPath = path.join(
          BACKUP_CONSTANTS.SSL_CERTS_PATH,
          `${domainName}.chain.crt`
        );
        await fs.writeFile(chainPath, sslFiles.chain, 'utf-8');
        logger.info(`SSL chain written for ${domainName}`);
      }
    } catch (error) {
      logger.error(`Error writing SSL files for ${domainName}:`, error);
      throw error;
    }
  }

  /**
   * Generate nginx vhost configuration for a domain during backup restore
   */
  async generateNginxConfigForBackup(domain: any): Promise<void> {
    try {
      await nginxConfigService.generateConfig(domain as DomainWithRelations);
      logger.info(
        `Nginx configuration generated for ${domain.name} during backup restore`
      );
    } catch (error) {
      logger.error(`Failed to write nginx config for ${domain.name}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const backupOperationsService = new BackupOperationsService();
