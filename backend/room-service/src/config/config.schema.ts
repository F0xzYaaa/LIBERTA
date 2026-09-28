import * as Joi from 'joi';

export const configSchema = Joi.object({
  PORT: Joi.number().default(3004),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().default('liberta_hotel'),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  ROOM_IMAGE_UPLOAD_DIR: Joi.string().default('/app/uploads/rooms'),
  ROOM_IMAGE_MAX_SIZE_BYTES: Joi.number().default(5 * 1024 * 1024),
});
