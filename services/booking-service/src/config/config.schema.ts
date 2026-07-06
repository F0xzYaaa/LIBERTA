import * as Joi from 'joi';

export const configSchema = Joi.object({
  PORT: Joi.number().default(3005),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().default('liberta_hotel'),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  BOOKING_DRAFT_LOCK_MINUTES: Joi.number().default(15),
});
