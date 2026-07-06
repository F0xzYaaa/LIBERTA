import * as Joi from 'joi';

export const configSchema = Joi.object({
  PORT: Joi.number().default(3003),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().default('liberta_hotel'),
});
