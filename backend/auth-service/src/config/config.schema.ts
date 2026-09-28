import * as Joi from 'joi';

export const configSchema = Joi.object({
  PORT: Joi.number().default(3001),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().default('liberta_hotel'),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES: Joi.string().default('24h'),
  // Staff/admin refresh token lifetime. Kept short (24h, was 7d) per 2026-07-11 CES decision —
  // the Redis-side refresh_jti TTL below is what actually enforces this, so it must match.
  JWT_REFRESH_EXPIRES: Joi.string().default('24h'),
  JWT_REFRESH_TTL_SECONDS: Joi.number().default(86400),
  MFA_TEMP_TOKEN_TTL_SECONDS: Joi.number().default(300),
  LOGIN_MAX_ATTEMPTS: Joi.number().default(5),
  LOGIN_LOCKOUT_WINDOW_SECONDS: Joi.number().default(900),
  INTERNAL_SERVICE_KEY: Joi.string().min(32).required(),
});
