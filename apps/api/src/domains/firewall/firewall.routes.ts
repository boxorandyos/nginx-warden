import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import {
  getFirewallState,
  updateFirewallSettings,
  addFirewallEntry,
  deleteFirewallEntry,
  previewFirewall,
  applyFirewall,
  crowdsecStatus,
  nftRuntime,
  crowdsecDecisions,
} from './firewall.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/state', getFirewallState);
router.put('/settings', updateFirewallSettings);
router.post('/entries', addFirewallEntry);
router.delete('/entries/:id', deleteFirewallEntry);
router.get('/preview', previewFirewall);
router.post('/apply', applyFirewall);
router.get('/crowdsec-status', crowdsecStatus);
router.get('/nft-runtime', nftRuntime);
router.get('/crowdsec-decisions', crowdsecDecisions);

export default router;
