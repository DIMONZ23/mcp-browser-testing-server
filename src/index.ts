import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { BrowserController } from "./browser.js";

const browser = new BrowserController();

const server = new McpServer({
  name: "mcp-browser-testing-server",
  version: "1.0.0",
});

server.registerTool(
  "browser_navigate",
  {
    title: "Navigate browser",
    description: "Navigate the headless browser to an HTTP or HTTPS URL.",
    inputSchema: {
      url: z.string().url().describe("The absolute HTTP or HTTPS URL to open."),
    },
  },
  async ({ url }) => {
    try {
      const result = await browser.navigate(url);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  "browser_inspect",
  {
    title: "Inspect page controls",
    description:
      "Automatically identify visible input areas, buttons, and links on the current page, including human-readable labels and stable selectors.",
    inputSchema: {},
  },
  async () => {
    try {
      const inspection = await browser.inspectPage();
      return {
        content: [{ type: "text", text: JSON.stringify(inspection, null, 2) }],
      };
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  "browser_interact",
  {
    title: "Interact with browser",
    description:
      "Click, type into, or scroll an element into view using a CSS or XPath selector.",
    inputSchema: {
      action: z.enum(["click", "type", "scroll"]),
      selector: z
        .string()
        .min(1)
        .describe('CSS selector or XPath selector such as "xpath=//button".'),
      text: z
        .string()
        .optional()
        .describe('Text to enter. Required only when action is "type".'),
    },
  },
  async (input) => {
    try {
      const message = await browser.interact(input);
      return { content: [{ type: "text", text: message }] };
    } catch (error) {
      return toolError(error);
    }
  },
);

server.registerTool(
  "browser_screenshot",
  {
    title: "Capture screenshot",
    description:
      "Capture a PNG screenshot of the whole page, viewport, or a selected element.",
    inputSchema: {
      fullPage: z
        .boolean()
        .optional()
        .default(true)
        .describe("Capture the full page. Ignored when selector is provided."),
      selector: z
        .string()
        .min(1)
        .optional()
        .describe("Optional CSS or XPath selector for an element screenshot."),
    },
  },
  async (input) => {
    try {
      const image = await browser.screenshot(input);
      return {
        content: [
          {
            type: "image",
            data: image.toString("base64"),
            mimeType: "image/png",
          },
        ],
      };
    } catch (error) {
      return toolError(error);
    }
  },
);

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

async function shutdown(signal: string): Promise<void> {
  console.error(`Received ${signal}; closing browser and MCP server.`);
  await browser.close();
  await server.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout dành riêng cho JSON-RPC; log vận hành phải luôn đi qua stderr.
  console.error("mcp-browser-testing-server is running over stdio.");
}

main().catch(async (error: unknown) => {
  console.error("Fatal error:", error);
  await browser.close();
  process.exit(1);
});
