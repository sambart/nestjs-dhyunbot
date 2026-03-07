import { envValidationSchema } from './env.validation';

export const BaseConfig = {
  isGlobal: true,
  envFilePath: `../../.env`,
  validationSchema: envValidationSchema,
  validationOptions: {
    abortEarly: false,
  },
};
