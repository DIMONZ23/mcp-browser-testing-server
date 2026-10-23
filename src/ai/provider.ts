import type { GenerateTestPlanInput, TestPlan } from "../domain/test-case.js";
import { GeminiTestPlanProvider } from "./gemini-provider.js";
import { OpenAITestPlanProvider } from "./openai-provider.js";

export interface TestPlanProvider {
  generate(input: GenerateTestPlanInput): Promise<TestPlan>;
  checkConnection(model: string): Promise<string>;
}

export function createTestPlanProvider(
  provider: GenerateTestPlanInput["provider"],
  apiKeyOverride?: string,
): TestPlanProvider {
  if (provider === "openai") {
    const apiKey = apiKeyOverride || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured on the server.");
    }
    return new OpenAITestPlanProvider(apiKey);
  }

  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }
  return new GeminiTestPlanProvider(apiKey);
}
