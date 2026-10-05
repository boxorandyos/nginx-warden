import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { hostUpdateAllowed, webSystemUpdateEnabled } from './maintenance';
import { describeRuntimes, planRuntime, runtimeTargets, type RuntimeComponent } from './runtime-plan';
import { resolveProjectRoot } from './system-update.service';

export function listRuntimes() {
  return describeRuntimes(process.version);
}

export async function scheduleRuntimeUpgrade(component: string): Promise<{ component: RuntimeComponent; executed: boolean; detail: string }> {
  const productEnabled = webSystemUpdateEnabled();
  const plan = planRuntime(component, hostUpdateAllowed(productEnabled));
  if (!plan.executed) return plan;
  const spec = runtimeTargets[plan.component];
  const root = resolveProjectRoot();
  const script = path.join(root, 'scripts', spec.script);
  if (!fs.existsSync(script)) {
    throw new Error(`Runtime script not found at ${script}. Set NGINX_WARDEN_ROOT to the install directory.`);
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn('bash', [script, ...spec.args], {
      cwd: root,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, [spec.confirm]: '1' },
    });
    child.on('error', reject);
    child.on('spawn', () => {
      child.unref();
      resolve();
    });
  });
  return plan;
}
