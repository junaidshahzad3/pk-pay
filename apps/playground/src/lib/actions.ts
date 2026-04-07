"use server";

import { PkPayClient } from "pk-pay";
import { playgroundConfigSchema, defaultRequestSchema, type PlaygroundConfig, type DefaultRequest } from "./schemas";

export async function createPlaygroundPayment(config: PlaygroundConfig, request: DefaultRequest) {
  try {
    // 1. Validate inputs
    const validatedConfig = playgroundConfigSchema.parse(config);
    const validatedRequest = defaultRequestSchema.parse(request);

    // 2. Initialize the stateful client with transient keys
    // We cast to any here because the playground allows optional fields for UI flexibility, 
    // while the SDK has strict validation which it handles internally anyway.
    const client = new PkPayClient(validatedConfig as any);

    // 3. Create the payment
    const result = await client.createPayment({
      provider: validatedRequest.provider,
      amount: validatedRequest.amount,
      currency: validatedRequest.currency,
      description: validatedRequest.description,
      customerPhone: validatedRequest.customerPhone,
      returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/playground/callback?provider=${validatedRequest.provider}`,
    });

    console.log(`✅ Playground payment created for ${validatedRequest.provider}`);

    return {
      success: true,
      data: result,
    };

  } catch (error: any) {
    console.error("❌ Playground Payment Error:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred during payment creation.",
      raw: error,
    };
  }
}
