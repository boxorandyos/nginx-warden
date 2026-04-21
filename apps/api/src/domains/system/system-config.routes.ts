import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import {
  getSystemConfig,
  updateNodeMode,
  updatePortalAccessOrigins,
  updateKeepalived,
  getNetworkInterfaces,
  restartFrontend,
  runSystemUpdate,
  getSystemUpdateLog,
  connectToMaster,
  disconnectFromMaster,
  testMasterConnection,
  syncWithMaster,
} from './system-config.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// System configuration routes
router.get('/', getSystemConfig);
router.put('/node-mode', updateNodeMode);
router.put('/portal-access', authorize('admin'), updatePortalAccessOrigins);
router.put('/keepalived', authorize('admin'), updateKeepalived);
router.get('/network-interfaces', authorize('admin'), getNetworkInterfaces);
router.post('/restart-frontend', authorize('admin'), restartFrontend);
router.post('/system-update', authorize('admin'), runSystemUpdate);
router.get('/system-update-log', authorize('admin'), getSystemUpdateLog);

// Slave mode routes
router.post('/connect-master', connectToMaster);
router.post('/disconnect-master', disconnectFromMaster);
router.post('/test-master-connection', testMasterConnection);
router.post('/sync', syncWithMaster);

export default router;
