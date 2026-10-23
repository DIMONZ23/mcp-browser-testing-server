import { GoogleGenAI } from "@google/genai";

import {
  TestPlanSchema,
  testPlanJsonSchema,
  type GenerateTestPlanInput,
  type TestPlan,
} from "../domain/test-case.js";
import { buildTestPlanPrompt } from "./prompt.js";
import type { TestPlanProvider } from "./provider.js";

export class GeminiTestPlanProvider implements TestPlanProvider {
  private readonly client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: 30_000 },
    });
  }

  async generate(input: GenerateTestPlanInput): Promise<TestPlan> {
    const response = await this.withRetry(() =>
      this.client.models.generateContent({
        model: input.model,
        contents: buildTestPlanPrompt(input),
        config: {
          systemInstruction:
            "You are a senior QA architect. Produce safe, deterministic, executable browser test plans.",
          responseMimeType: "application/json",
          responseJsonSchema: testPlanJsonSchema,
        },
      }),
    );

    if (!response.text) {
      throw new Error("Gemini did not return a structured test plan.");
    }

    return TestPlanSchema.parse(JSON.parse(response.text));
  }

  async checkConnection(model: string): Promise<string> {
    const response = await this.withRetry(() =>
      this.client.models.generateContent({
        model,
        contents: "Reply with exactly: API connection successful",
        config: { maxOutputTokens: 20 },
      }),
    );
    return response.text || "Gemini API connection successful.";
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    const delays = [0, 1_500, 3_000, 6_000];
    let lastError: unknown;

    for (const delay of delays) {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const transient =
          message.includes('"code":503') ||
          message.includes('"code":429') ||
          message.includes("UNAVAILABLE") ||
          message.toLowerCase().includes("high demand");
        if (!transient) {
          throw error;
        }
      }
    }

    throw lastError;
  }
}
