import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { ResponseUtil } from '../../shared/utils/response.util';
import { identityAdminService } from './identity-admin.service';
import logger from '../../utils/logger';
import { AuthAuditLevel, AuthAuditOutcome } from '@prisma/client';

export class IdentityController {
  async listProviders(_req: AuthRequest, res: Response) {
    try {
      const items = await identityAdminService.listProviders();
      ResponseUtil.success(res, items);
    } catch (e: any) {
      logger.error('listProviders', e);
      ResponseUtil.error(res, e.message || 'Failed to list providers', e.statusCode || 500);
    }
  }

  async updateProvider(req: AuthRequest, res: Response) {
    try {
      const item = await identityAdminService.updateProvider(req.params.id, req.body);
      ResponseUtil.success(res, item, 'Provider updated');
    } catch (e: any) {
      logger.error('updateProvider', e);
      ResponseUtil.error(res, e.message || 'Failed to update provider', e.statusCode || 400);
    }
  }

  async listPolicies(_req: AuthRequest, res: Response) {
    try {
      const items = await identityAdminService.listPolicies();
      ResponseUtil.success(res, items);
    } catch (e: any) {
      logger.error('listPolicies', e);
      ResponseUtil.error(res, e.message || 'Failed to list policies', e.statusCode || 500);
    }
  }

  async updatePolicy(req: AuthRequest, res: Response) {
    try {
      const item = await identityAdminService.updatePolicy(req.params.id, req.body);
      ResponseUtil.success(res, item, 'Policy updated');
    } catch (e: any) {
      logger.error('updatePolicy', e);
      ResponseUtil.error(res, e.message || 'Failed to update policy', e.statusCode || 400);
    }
  }

  async createGatewayPolicy(req: AuthRequest, res: Response) {
    try {
      const item = await identityAdminService.createGatewayPolicy(req.body);
      ResponseUtil.success(res, item, 'Gateway policy created', 201);
    } catch (e: any) {
      logger.error('createGatewayPolicy', e);
      ResponseUtil.error(res, e.message || 'Failed to create policy', e.statusCode || 400);
    }
  }

  async listAuditLogs(req: AuthRequest, res: Response) {
    try {
      const result = await identityAdminService.listAuditLogs({
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        outcome: req.query.outcome as AuthAuditOutcome | undefined,
        level: req.query.level as AuthAuditLevel | undefined,
        username: req.query.username as string | undefined,
        ip: req.query.ip as string | undefined,
      });
      ResponseUtil.success(res, result);
    } catch (e: any) {
      logger.error('listAuditLogs', e);
      ResponseUtil.error(res, e.message || 'Failed to list audit logs', e.statusCode || 500);
    }
  }

  async getAbuseSettings(_req: AuthRequest, res: Response) {
    try {
      const item = await identityAdminService.getAbuseSettings();
      ResponseUtil.success(res, item);
    } catch (e: any) {
      ResponseUtil.error(res, e.message || 'Failed', 500);
    }
  }

  async updateAbuseSettings(req: AuthRequest, res: Response) {
    try {
      const item = await identityAdminService.updateAbuseSettings(req.body);
      ResponseUtil.success(res, item, 'Abuse settings updated');
    } catch (e: any) {
      ResponseUtil.error(res, e.message || 'Failed', 400);
    }
  }

  async listAbuseStates(_req: AuthRequest, res: Response) {
    try {
      const items = await identityAdminService.listAbuseStates();
      ResponseUtil.success(res, items);
    } catch (e: any) {
      ResponseUtil.error(res, e.message || 'Failed', 500);
    }
  }

  async clearAbuseState(req: AuthRequest, res: Response) {
    try {
      const key = decodeURIComponent(req.params.key);
      await identityAdminService.clearAbuseState(key);
      ResponseUtil.success(res, { ok: true }, 'Abuse state cleared');
    } catch (e: any) {
      ResponseUtil.error(res, e.message || 'Failed', 400);
    }
  }
}

export const identityController = new IdentityController();
