import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  FRONTEND_URL: z.string().url().default('http://localhost:8081'),

  EXCHANGE_RATE_PROVIDER_URL: z.string().url().optional(),
  EXCHANGE_RATE_CACHE_TTL_MS: z.coerce.number().default(6 * 60 * 60 * 1000),

  AI_API_URL: z.string().url().optional(),
  AI_API_KEY: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function getEnv(): Env {
  if (env) return env;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  env = result.data;
  return env;
}

export function validateEnv(): Env {
  return getEnv();
}
