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
        'pgrep nginx > /dev/null && echo "running" || echo "not running"',
        { timeout: 5000 }
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
   * Stop orphan nginx masters that hold listen ports while systemd is inactive.
   * Without this, `nginx` / `systemctl start` fails with "Address already in use".
   */
  private async clearOrphanNginx(): Promise<void> {
    try {
      await execAsync(
        'bash -c \'' +
          'if command -v systemctl >/dev/null 2>&1 && ! systemctl is-active --quiet nginx 2>/dev/null; then ' +
          '  if pgrep -x nginx >/dev/null 2>&1; then ' +
          '    nginx -s quit 2>/dev/null || pkill -QUIT -x nginx 2>/dev/null || true; ' +
          '    for i in 1 2 3 4 5 6 7 8 9 10; do pgrep -x nginx >/dev/null 2>&1 || break; sleep 0.5; done; ' +
          '    pkill -TERM -x nginx 2>/dev/null || true; sleep 0.5; ' +
          '    pkill -KILL -x nginx 2>/dev/null || true; ' +
          '    rm -f /run/nginx.pid /var/run/nginx.pid 2>/dev/null || true; ' +
          '  fi; ' +
          'fi' +
          '\'',
        { timeout: 20000 }
      );
    } catch (error: any) {
      logger.warn('⚠️ Orphan nginx cleanup skipped/failed:', error.message);
    }
  }

  /**
   * Attempt to restart nginx safely
   */
  private async attemptRestart(): Promise<boolean> {
    try {
      logger.info('♻️ Restarting nginx...');

      await this.clearOrphanNginx();

      // Clean up old PID if exists
      await execAsync('rm -f /var/run/nginx.pid /run/nginx.pid || true');

      // Verify config
      await execAsync('nginx -t', { timeout: 15000 });

      // Prefer systemd so the unit tracks the process; fall back to direct start
      try {
        await execAsync(
          'systemctl reset-failed nginx 2>/dev/null; systemctl restart nginx || systemctl start nginx',
          { timeout: 30000 }
        );
      } catch {
        await this.clearOrphanNginx();
        await execAsync('nginx', { timeout: 15000 });
      }

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
