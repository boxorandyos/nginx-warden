import { Request, Response } from 'express';
import prisma from '../../config/database';
import { AuthRequest } from '../../middleware/auth';
import { SlaveRequest } from './cluster.types';
import { clusterService } from './cluster.service';
import { maintenanceKeyMatches, parseMaintenanceKind } from '../system/maintenance';
import { runLocalMaintenance } from '../system/slave-upgrade.service';
import logger from '../../utils/logger';

/**
 * Register new slave node
 */
export const registerSlaveNode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, host, port, syncInterval } = req.body;

    const result = await clusterService.registerSlaveNode(
      { name, host, port, syncInterval },
      req.user?.userId
    );

    res.status(201).json({
      success: true,
      message: 'Slave node registered successfully',
      data: result
    });
  } catch (error: any) {
    logger.error('Register slave node error:', error);
    res.status(error.message === 'Slave node with this name already exists' ? 400 : 500).json({
      success: false,
      message: error.message || 'Failed to register slave node'
    });
  }
};

/**
 * Get all slave nodes
 */
export const getSlaveNodes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nodes = await clusterService.getAllSlaveNodes();

    res.json({
      success: true,
      data: nodes
    });
  } catch (error) {
    logger.error('Get slave nodes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get slave nodes'
    });
  }
};

/**
 * Get single slave node
 */
export const getSlaveNode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const node = await clusterService.getSlaveNodeById(id);

    res.json({
      success: true,
      data: node
    });
  } catch (error: any) {
    logger.error('Get slave node error:', error);
    res.status(error.message === 'Slave node not found' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to get slave node'
    });
  }
};

/**
 * Delete slave node
 */
export const deleteSlaveNode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await clusterService.deleteSlaveNode(id, req.user?.userId);

    res.json({
      success: true,
      message: 'Slave node deleted successfully'
    });
  } catch (error) {
    logger.error('Delete slave node error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete slave node'
    });
  }
};

/**
 * Health check endpoint (called by master to verify slave is alive)
 */
export const healthCheck = async (req: SlaveRequest, res: Response): Promise<void> => {
  try {
    const data = await clusterService.healthCheck(
      req.slaveNode?.id,
      req.slaveNode?.name
    );

    res.json({
      success: true,
      message: 'Slave node is healthy',
      data
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed'
    });
  }
};

/**
 * Master calls this on a slave with the API key the slave stored as masterApiKey.
 */
export const acceptMasterMaintenance = async (req: Request, res: Response): Promise<void> => {
  try {
    const presented = req.header('x-api-key') ?? undefined;
    const config = await prisma.systemConfig.findFirst();
    if (!maintenanceKeyMatches(config?.masterApiKey, presented)) {
      res.status(401).json({ success: false, message: 'Invalid API key' });
      return;
    }
    if (config?.nodeMode !== 'slave') {
      res.status(403).json({ success: false, message: 'This node is not a slave' });
      return;
    }
    const kind = parseMaintenanceKind(req.body?.kind);
    const result = await runLocalMaintenance(kind);
    logger.info('Accepted maintenance from master', { kind });
    res.json({ success: true, message: 'Maintenance scheduled', data: result });
  } catch (error) {
    logger.error('Master maintenance error:', error);
    const message = error instanceof Error ? error.message : 'Maintenance failed';
    res.status(message.includes('kind must') ? 400 : 500).json({ success: false, message });
  }
};
