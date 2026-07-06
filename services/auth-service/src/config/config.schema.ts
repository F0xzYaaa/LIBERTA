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
  JWT_REFRESH_EXPIRES: Joi.string().default('7d'),
  JWT_REFRESH_TTL_SECONDS: Joi.number().default(604800),
  MFA_TEMP_TOKEN_TTL_SECONDS: Joi.number().default(300),
  INTERNAL_SERVICE_KEY: Joi.string().min(32).required(),
});
