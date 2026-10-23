import "dotenv/config";
import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import { z, ZodError } from "zod";

import { createTestPlanProvider } from "./ai/provider.js";
import { BrowserController } from "./browser.js";
import {
  GenerateTestPlanInputSchema,
  RunTestCaseInputSchema,
} from "./domain/test-case.js";
import { TestCaseRunner } from "./test-runner.js";

const GenerateRequestSchema = GenerateTestPlanInputSchema.extend({
  apiKey: z.string().min(10).optional(),
});

const ConnectionRequestSchema = z.object({
  provider: z.enum(["openai", "gemini"]),
  model: z.string().min(1).max(100),
  apiKey: z.string().min(10).optional(),
});

const BrowserPreviewRequestSchema = z.object({
  url: z.string().url(),
});

const runner = new TestCaseRunner();
const webRoot = new URL("../web/", import.meta.url);
const host = process.env.DASHBOARD_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.DASHBOARD_PORT ?? "3210", 10);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("DASHBOARD_PORT must be an integer between 1 and 65535.");
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > 1_000_000) {
      throw new Error("Request body exceeds the 1 MB limit.");
    }
    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

async function sendAsset(
  response: ServerResponse,
  fileName: string,
  contentType: string,
): Promise<void> {
  const content = await readFile(new URL(fileName, webRoot));
  response.writeHead(200, {
    "content-type": contentType,
    "cache-control": "no-cache",
    "x-content-type-options": "nosniff",
  });
  response.end(content);
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);

  if (method === "GET" && url.pathname === "/") {
    return sendAsset(response, "index.html", "text/html; charset=utf-8");
  }
  if (method === "GET" && url.pathname === "/styles.css") {
    return sendAsset(response, "styles.css", "text/css; charset=utf-8");
  }
  if (method === "GET" && url.pathname === "/app.js") {
    return sendAsset(response, "app.js", "text/javascript; charset=utf-8");
  }
  if (method === "GET" && url.pathname === "/api/config") {
    return sendJson(response, 200, {
      providers: {
        openai: {
          configured: Boolean(process.env.OPENAI_API_KEY),
          defaultModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        },
        gemini: {
          configured: Boolean(process.env.GEMINI_API_KEY),
          defaultModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
        },
      },
    });
  }
  if (method === "POST" && url.pathname === "/api/providers/test") {
    const input = ConnectionRequestSchema.parse(await readJsonBody(request));
    const provider = createTestPlanProvider(input.provider, input.apiKey);
    const reply = await provider.checkConnection(input.model);
    return sendJson(response, 200, { connected: true, provider: input.provider, reply });
  }
  if (method === "POST" && url.pathname === "/api/test-plans") {
    const input = GenerateRequestSchema.parse(await readJsonBody(request));
    const provider = createTestPlanProvider(input.provider, input.apiKey);
    const browser = new BrowserController();
    try {
      await browser.navigate(input.targetUrl);
      const pageInspection = await browser.inspectPage();
      const { apiKey: _apiKey, ...planInput } = input;
      const plan = await provider.generate({ ...planInput, pageContext: pageInspection });
      return sendJson(response, 200, { ...plan, pageInspection });
    } finally {
      await browser.close();
    }
  }
  if (method === "POST" && url.pathname === "/api/test-runs") {
    const input = RunTestCaseInputSchema.parse(await readJsonBody(request));
    return sendJson(response, 200, await runner.run(input.testCase, input.targetUrl));
  }
  if (method === "POST" && url.pathname === "/api/browser-preview") {
    const input = BrowserPreviewRequestSchema.parse(await readJsonBody(request));
    const browser = new BrowserController();
    try {
      const navigation = await browser.navigate(input.url);
      const image = await browser.screenshot({ fullPage: false });
      return sendJson(response, 200, {
        ...navigation,
        screenshotDataUrl: `data:image/png;base64,${image.toString("base64")}`,
      });
    } finally {
      await browser.close();
    }
  }
  if (method === "POST" && url.pathname === "/api/test-runs/stream") {
    const input = RunTestCaseInputSchema.parse(await readJsonBody(request));
    response.writeHead(200, {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-content-type-options": "nosniff",
    });

    const writeEvent = (event: unknown): void => {
      response.write(`${JSON.stringify(event)}\n`);
    };

    writeEvent({
      type: "started",
      testCaseId: input.testCase.id,
      title: input.testCase.title,
      totalSteps: input.testCase.steps.length,
    });

    const result = await runner.run(input.testCase, input.targetUrl, (step, index) => {
      writeEvent({ type: "step", index, step });
    });
    // Step events đã gửi ảnh viewport; không lặp lại toàn bộ base64 trong event cuối.
    const summary = {
      ...result,
      steps: result.steps.map(({ screenshotDataUrl, browserScreenshotDataUrl, ...step }) => step),
    };
    writeEvent({ type: "completed", result: summary });
    response.end();
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

const server = createServer((request, response) => {
  void route(request, response).catch((error: unknown) => {
    if (response.headersSent) {
      response.end(
        `${JSON.stringify({
          type: "error",
          message: error instanceof Error ? error.message : "Internal server error.",
        })}\n`,
      );
      return;
    }

    if (error instanceof ZodError) {
      return sendJson(response, 400, {
        error: "Dữ liệu không hợp lệ.",
        details: error.issues,
      });
    }

    console.error(error instanceof Error ? error.message : error);
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Internal server error.",
    });
  });
});

server.listen(port, host, () => {
  console.log(`AI Test Studio is available at http://${host}:${port}`);
});

function shutdown(): void {
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
