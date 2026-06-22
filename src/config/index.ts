import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  REDIS_URL: z.string().url().or(z.string().startsWith('redis://')).default('redis://localhost:6379'),

  HMAC_SECRET_SALT: z.string().min(1),
  JWT_SECRET: z.string().min(1).optional(),

  /** Skip HMAC verification in development (API key still required). */
  DEV_SKIP_HMAC: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  /** Ramp/FX execution: ripple_otc | openfx (BVNK is fiat rails only). */
  ROUTING_PROVIDER: z.enum(['ripple_otc', 'openfx']).default('ripple_otc'),

  BVNK_API_KEY: z.string().optional(),
  SUMSUB_APP_TOKEN: z.string().optional(),
  SUMSUB_SECRET_KEY: z.string().optional(),
  CHAINALYSIS_API_KEY: z.string().optional(),
  PLAID_CLIENT_ID: z.string().optional(),
  PLAID_SECRET: z.string().optional(),
  TRUELAYER_CLIENT_ID: z.string().optional(),
  TRUELAYER_CLIENT_SECRET: z.string().optional(),
});

export type Config = z.infer<typeof envSchema> & { JWT_SECRET: string };

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  const config = parsed.data;

  return {
    ...config,
    JWT_SECRET: config.JWT_SECRET ?? config.HMAC_SECRET_SALT,
  };
}

export const config = loadConfig();
