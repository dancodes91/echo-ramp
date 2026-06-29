import { hashApiKey } from '../lib/crypto.js';
import { closePool, getPool } from './client.js';
import { integratorsRepo } from './repositories/integrators.repo.js';
import { pathToFileURL } from 'node:url';

/** Dev-only seed: one integrator with documented API credentials. */
export const DEV_INTEGRATOR = {
  name: 'Dev Integrator',
  apiKey: 'echo_dev_api_key',
  apiSecret: 'echo_dev_api_secret',
} as const;

export async function seedDevIntegrator(): Promise<void> {
  const pool = getPool();

  const existing = await pool.query(
    'SELECT id FROM integrator_accounts WHERE api_key_hash = $1',
    [hashApiKey(DEV_INTEGRATOR.apiKey)],
  );

  if ((existing.rowCount ?? 0) > 0) {
    return;
  }

  await integratorsRepo.create({
    name: DEV_INTEGRATOR.name,
    apiKeyHash: hashApiKey(DEV_INTEGRATOR.apiKey),
    apiSecretEncrypted: DEV_INTEGRATOR.apiSecret,
    revenueShareBps: 0,
  });
}

async function main(): Promise<void> {
  await seedDevIntegrator();
  console.log('Seeded dev integrator');
  console.log(`  API key:    ${DEV_INTEGRATOR.apiKey}`);
  console.log(`  API secret: ${DEV_INTEGRATOR.apiSecret}`);
  await closePool();
}

const isMainModule =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

