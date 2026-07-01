import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://echo:echo@localhost:5432/echo_ramp_test',
      HMAC_SECRET_SALT: 'test-secret',
      JWT_SECRET: 'test-jwt-secret',
      DEV_SKIP_HMAC: 'true',
      ROUTING_PROVIDER: 'lydiam',
      FIAT_PROVIDER: 'bcb',
      RELAX_STATE_GUARDS: 'true',
    },
  },
});
