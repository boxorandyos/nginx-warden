import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../../../utils/logger';
import { NginxReloadResult, EnvironmentInfo } from '../domains.types';

const execAsync = promisify(exec);

/**
 * Service for reloading and restarting Nginx safely
 */
export class NginxReloadService {
  /**
   * Detect environment (container vs host)
   */
  private detectEnvironment(): EnvironmentInfo {
    const isContainer =
      process.env.NODE_ENV === 'development' ||
      process.env.CONTAINERIZED === 'true';

    return {
      isContainer,
      nodeEnv: process.env.NODE_ENV || 'production',
    };
  }

  /**
   * Test nginx configuration validity
   */
  private async testConfig(): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync('nginx -t', { timeout: 15000 });
      logger.info('✅ Nginx configuration test passed');
      return { success: true };
    } catch (error: any) {
      logger.error('❌ Nginx configuration test failed:', error.stderr);
      return { success: false, error: error.stderr };
    }
  }

  /**
   * Check if nginx process is running
   */
  private async verifyRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        'pgrep nginx > /dev/null && echo "running" || echo "not running"'
      );
      return stdout.trim() === 'running';
    } catch {
      return false;
    }
  }

  /**
   * Attempt graceful reload (reload without stop)
   */
  private async attemptReload(): Promise<boolean> {
    try {
      logger.info('🔁 Attempting graceful nginx reload...');
      await execAsync('nginx -t', { timeout: 15000 }); // check config before reload

      try {
        await execAsync('nginx -s reload', { timeout: 15000 });
      } catch (e) {
        logger.warn('⚠️ Reload failed, forcing restart instead...');
        await execAsync('rm -f /var/run/nginx.pid && nginx', { timeout: 15000 });
      }

      // wait a little for reload to apply
      await new Promise((r) => setTimeout(r, 500));

      const isRunning = await this.verifyRunning();

      if (isRunning) {
        logger.info('✅ Nginx reloaded successfully');
        return true;
      }

      logger.warn('⚠️ Nginx reload reported as not running, fallback to restart');
      return false;
    } catch (error: any) {
      logger.error('❌ Graceful reload failed:', error.message);
      return false;
    }
  }

  /**
   * Attempt to restart nginx safely
   */
  private async attemptRestart(): Promise<boolean> {
    try {
      logger.info('♻️ Restarting nginx...');

      // Clean up old PID if exists
      await execAsync('rm -f /var/run/nginx.pid || true');

      // Verify config
      await execAsync('nginx -t', { timeout: 15000 });

      // Start nginx fresh
      await execAsync('nginx', { timeout: 15000 });

      // Give it time to come up
      await new Promise((r) => setTimeout(r, 1000));

      const isRunning = await this.verifyRunning();
      if (!isRunning) {
        throw new Error('Nginx failed to start after restart');
      }

      logger.info('✅ Nginx restarted successfully');
      return true;
    } catch (error: any) {
      logger.error('❌ Nginx restart failed:', error.stderr || error.message);
      throw error;
    }
  }

  /**
   * Auto reload nginx with retry logic
   */
  async autoReload(silent: boolean = false): Promise<boolean> {
    try {
      const env = this.detectEnvironment();
      logger.info(
        `🌍 Environment check - Container: ${env.isContainer}, Node Env: ${env.nodeEnv}`
      );

      // Step 1: Test config
      const configTest = await this.testConfig();
      if (!configTest.success) {
        if (!silent) throw new Error(`Nginx config test failed: ${configTest.error}`);
        return false;
      }

      // Step 2: Try reload first
      const reloadSuccess = await this.attemptReload();
      if (reloadSuccess) return true;

      // Step 3: Fallback to restart
      logger.warn('🔁 Graceful reload failed, trying restart...');
      await this.attemptRestart();
      return true;
    } catch (error: any) {
      logger.error('❌ Auto reload nginx failed:', error);
      if (!silent) throw error;
      return false;
    }
  }

  /**
   * Manual reload endpoint handler
   */
  async reload(): Promise<NginxReloadResult> {
    try {
      const env = this.detectEnvironment();
      logger.info(
        `[reloadNginx] Environment - Container: ${env.isContainer}, Node Env: ${env.nodeEnv}`
      );

      const configTest = await this.testConfig();
      if (!configTest.success) {
        return {
          success: false,
          error: `Nginx configuration test failed: ${configTest.error}`,
        };
      }

      const reloadSuccess = await this.attemptReload();

      if (reloadSuccess) {
        return {
          success: true,
          method: 'reload',
          mode: env.isContainer ? 'container' : 'host',
        };
      }

      logger.info('[reloadNginx] Reload failed, performing restart...');
      await this.attemptRestart();

      return {
        success: true,
        method: 'restart',
        mode: env.isContainer ? 'container' : 'host',
      };
    } catch (error: any) {
      logger.error('[reloadNginx] Reload nginx error:', error);
      return {
        success: false,
        error: error.message || 'Failed to reload nginx',
      };
    }
  }
}

// Export singleton instance
export const nginxReloadService = new NginxReloadService();
