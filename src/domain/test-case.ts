import { z } from "zod";

export const TestActionSchema = z.enum([
  "navigate",
  "click",
  "type",
  "scroll",
  "assert_visible",
  "assert_text",
  "screenshot",
]);

export const TestStepSchema = z.object({
  id: z.string().min(1),
  action: TestActionSchema,
  description: z.string().min(1),
  selector: z.string().nullable(),
  value: z.string().nullable(),
  expected: z.string().min(1),
});

export const TestCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.enum([
    "functional",
    "negative",
    "boundary",
    "usability",
    "security",
  ]),
  priority: z.enum(["critical", "high", "medium", "low"]),
  objective: z.string().min(1),
  preconditions: z.array(z.string()),
  steps: z.array(TestStepSchema).min(1),
  expectedResult: z.string().min(1),
});

export const TestPlanSchema = z.object({
  answer: z.string().min(1),
  assumptions: z.array(z.string()),
  testCases: z.array(TestCaseSchema).min(1),
});

export const PageElementDescriptorSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["input", "textarea", "select", "button", "link", "editable"]),
  label: z.string(),
  selector: z.string().min(1),
  inputType: z.string().nullable(),
  placeholder: z.string().nullable(),
  required: z.boolean(),
  disabled: z.boolean(),
});

export const PageInspectionSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  inputAreas: z.array(PageElementDescriptorSchema),
  actions: z.array(PageElementDescriptorSchema),
});

export const GenerateTestPlanInputSchema = z.object({
  provider: z.enum(["openai", "gemini"]),
  model: z.string().min(1).max(100),
  targetUrl: z.string().url(),
  requirement: z.string().trim().min(1).max(20_000),
  count: z.number().int().min(1).max(12),
  pageContext: PageInspectionSchema.optional(),
});

export const RunTestCaseInputSchema = z.object({
  targetUrl: z.string().url(),
  testCase: TestCaseSchema,
});

export type TestStep = z.infer<typeof TestStepSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestPlan = z.infer<typeof TestPlanSchema>;
export type GenerateTestPlanInput = z.infer<typeof GenerateTestPlanInputSchema>;

// Schema thuần được dùng cho Gemini Structured Output. Giữ cấu trúc này đồng
// bộ với Zod schema ở trên; kết quả cuối cùng vẫn luôn được Zod kiểm tra lại.
export const testPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    testCases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          category: {
            type: "string",
            enum: ["functional", "negative", "boundary", "usability", "security"],
          },
          priority: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
          },
          objective: { type: "string" },
          preconditions: { type: "array", items: { type: "string" } },
          steps: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                action: {
                  type: "string",
                  enum: [
                    "navigate",
                    "click",
                    "type",
                    "scroll",
                    "assert_visible",
                    "assert_text",
                    "screenshot",
                  ],
                },
                description: { type: "string" },
                selector: { type: ["string", "null"] },
                value: { type: ["string", "null"] },
                expected: { type: "string" },
              },
              required: ["id", "action", "description", "selector", "value", "expected"],
            },
          },
          expectedResult: { type: "string" },
        },
        required: [
          "id",
          "title",
          "category",
          "priority",
          "objective",
          "preconditions",
          "steps",
          "expectedResult",
        ],
      },
    },
  },
  required: ["answer", "assumptions", "testCases"],
} as const;
