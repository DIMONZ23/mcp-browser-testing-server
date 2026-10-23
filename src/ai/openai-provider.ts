import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  TestPlanSchema,
  type GenerateTestPlanInput,
  type TestPlan,
} from "../domain/test-case.js";
import { buildTestPlanPrompt } from "./prompt.js";
import type { TestPlanProvider } from "./provider.js";

export class OpenAITestPlanProvider implements TestPlanProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(input: GenerateTestPlanInput): Promise<TestPlan> {
    const response = await this.client.responses.parse({
      model: input.model,
      input: [
        {
          role: "system",
          content:
            "You are a senior QA architect. Produce safe, deterministic, executable browser test plans.",
        },
        { role: "user", content: buildTestPlanPrompt(input) },
      ],
      text: {
        format: zodTextFormat(TestPlanSchema, "browser_test_plan"),
      },
    });

    if (!response.output_parsed) {
      throw new Error("OpenAI did not return a structured test plan.");
    }

    return TestPlanSchema.parse(response.output_parsed);
  }

  async checkConnection(model: string): Promise<string> {
    const response = await this.client.responses.create({
      model,
      input: "Reply with exactly: API connection successful",
      max_output_tokens: 20,
    });
    return response.output_text || "OpenAI API connection successful.";
  }
}
