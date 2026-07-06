import * as Joi from 'joi';

export const configSchema = Joi.object({
  PORT: Joi.number().default(3002),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().default('liberta_hotel'),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  TOTP_ISSUER: Joi.string().default('LIBERTA หัวหิน'),
  MFA_MAX_VERIFY_ATTEMPTS: Joi.number().default(5),
  MFA_TEMP_TOKEN_TTL_SECONDS: Joi.number().default(300),
  INTERNAL_SERVICE_KEY: Joi.string().min(32).required(),
  AUTH_SERVICE_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
});
