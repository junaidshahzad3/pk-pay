import { z } from "zod";

export const playgroundConfigSchema = z.object({
  environment: z.enum(["sandbox", "production"]),
  jazzcash: z.object({
    merchantId: z.string().optional(),
    password: z.string().optional(),
    integritySalt: z.string().optional(),
  }).optional(),
  easypaisa: z.object({
    storeId: z.string().optional(),
    hashKey: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
  stripe: z.object({
    secretKey: z.string().optional(),
    webhookSecret: z.string().optional(),
  }).optional(),
});

export type PlaygroundConfig = z.infer<typeof playgroundConfigSchema>;

export const defaultRequestSchema = z.object({
  provider: z.string(),
  amount: z.number().positive(),
  currency: z.string().default("PKR"),
  description: z.string().default("Playground Transaction"),
  customerPhone: z.string().optional(),
});

export type DefaultRequest = z.infer<typeof defaultRequestSchema>;
