import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { identityController } from './identity.controller';

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/providers', (req, res) => identityController.listProviders(req, res));
router.patch('/providers/:id', (req, res) => identityController.updateProvider(req, res));

router.get('/policies', (req, res) => identityController.listPolicies(req, res));
router.patch('/policies/:id', (req, res) => identityController.updatePolicy(req, res));
router.post('/policies/gateway', (req, res) => identityController.createGatewayPolicy(req, res));

router.get('/audit-logs', (req, res) => identityController.listAuditLogs(req, res));

router.get('/abuse/settings', (req, res) => identityController.getAbuseSettings(req, res));
router.put('/abuse/settings', (req, res) => identityController.updateAbuseSettings(req, res));
router.get('/abuse/states', (req, res) => identityController.listAbuseStates(req, res));
router.delete('/abuse/states/:key', (req, res) => identityController.clearAbuseState(req, res));

export default router;
