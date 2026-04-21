import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import logger from '../../utils/logger';
import { ResponseUtil } from '../../shared/utils/response.util';
import { SystemService } from './system.service';
import * as defaultServerService from './default-server.service';

const systemService = new SystemService();

/**
 * Get installation status
 */
export const getInstallationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = await systemService.getInstallationStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Get installation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get installation status',
    });
  }
};

/**
 * Get nginx status
 */
export const getNginxStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = await systemService.getNginxStatus();

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Get nginx status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get nginx status',
    });
  }
};

/**
 * Start installation
 */
export const startInstallation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await systemService.startInstallation(req.user!.role, req.user!.username);

    res.json({
      success: true,
      message: 'Installation started in background',
    });
  } catch (error: any) {
    logger.error('Start installation error:', error);

    if (error.message === 'Only admins can start installation') {
      res.status(403).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (error.message === 'Nginx is already installed') {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to start installation',
    });
  }
};

/**
 * Get current system metrics
 */
export const getSystemMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const metrics = await systemService.getSystemMetrics();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Get system metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Manually trigger alert monitoring check
 */
export const triggerAlertCheck = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await systemService.triggerAlertCheck(req.user!.username);

    res.json({
      success: true,
      message: 'Alert monitoring check triggered successfully. Check logs for details.'
    });
  } catch (error: any) {
    logger.error('Trigger alert check error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Default nginx catch-all server + static index (paths on the API host)
 */
export const getDefaultServer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await defaultServerService.getDefaultServer();
    ResponseUtil.success(res, data);
  } catch (error: any) {
    logger.error('Get default server error:', error);
    ResponseUtil.error(res, error?.message || 'Failed to read default server configuration', 500);
  }
};

export const updateDefaultServer = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { nginxConfig, indexHtml } = req.body as {
      nginxConfig?: string;
      indexHtml?: string;
    };
    if (typeof nginxConfig !== 'string' || typeof indexHtml !== 'string') {
      ResponseUtil.error(res, 'nginxConfig and indexHtml are required', 400);
      return;
    }
    await defaultServerService.updateDefaultServer(nginxConfig, indexHtml);
    ResponseUtil.success(res, { ok: true }, 'Default server updated and nginx reloaded');
  } catch (error: any) {
    logger.error('Update default server error:', error);
    const msg = error?.message || 'Failed to update default server';
    const status = /cannot be empty|must contain|should include/i.test(msg) ? 400 : 500;
    ResponseUtil.error(res, msg, status);
  }
};
