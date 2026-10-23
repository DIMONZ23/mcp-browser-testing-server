# mcp-browser-testing-server

An open-source Model Context Protocol (MCP) server that lets AI agents control a
headless Chromium browser through Playwright for browser automation, end-to-end
testing, screenshots, and debugging.

## Legal Disclaimer

This tool is developed and provided exclusively for legitimate automated
end-to-end (E2E) testing and academic research. You are responsible for ensuring
that every target, account, and dataset you access is authorized and that your
use complies with all applicable laws, policies, and third-party Terms of
Service.

The authors and contributors are not responsible or liable for misuse of this
software, including but not limited to unauthorized scraping, spam, abusive
automation, bypassing bot-detection or access-control systems, or any activity
that violates a third party's Terms of Service. Do not use this project to evade
technical safeguards or to access systems without explicit permission.

For transparency, every browser context automatically uses a User-Agent that
contains the project identifier:

```text
Mozilla/5.0 ... (MCP-Browser-Testing-Bot/1.0; OpenSource-Disclaimer-Applied)
```

## Features

- Headless Chromium automation powered by Playwright and its auto-wait behavior.
- A persistent browser session shared across MCP tool calls.
- Automatic page mapping of visible fields, buttons, and links with labels and stable selectors.
- CSS and XPath locator support.
- Full-page, viewport, and element screenshots returned directly as MCP image
  content.
- Standard input/output transport for Claude Desktop and other MCP hosts.
- Local AI Test Studio UI for asking QA questions and generating structured test cases.
- Bilingual English/Vietnamese Dashboard, with English selected by default.
- OpenAI and Google Gemini providers with server-side API key support.
- Executable test plans with assertions, screenshots, per-step timing, and pass/fail results.
- Separate ESM executables for the MCP server and local Dashboard, generated with tsup.

## Available tools

| Tool | Purpose |
| --- | --- |
| `browser_navigate` | Open an absolute HTTP or HTTPS URL. |
| `browser_inspect` | Detect visible input areas and actions with labels and reusable selectors. |
| `browser_interact` | `click`, `type`, or `scroll` an element selected with CSS or XPath. |
| `browser_screenshot` | Capture the full page, viewport, or one selected element as PNG. |

## Requirements

- Node.js 20 or newer.
- A supported Playwright Chromium binary.
- An OpenAI API key and/or a Google Gemini API key for AI test-plan generation.

> A ChatGPT Plus subscription does not include OpenAI API usage. ChatGPT and the
> API Platform use separate billing systems. Create and fund an API account at
> [platform.openai.com](https://platform.openai.com/) before using the OpenAI
> provider.

## Install and run with npx

After this package has been published to npm, install the Chromium binary once:

```bash
npx playwright install chromium
```

Then start the MCP server:

```bash
npx -y mcp-browser-testing-server@latest
```

The process communicates through stdio, so it normally appears idle when
started directly. An MCP host launches it and exchanges JSON-RPC messages over
stdin/stdout.

## Claude Desktop configuration

Add the server to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "browser-testing": {
      "command": "npx",
      "args": ["-y", "mcp-browser-testing-server@latest"]
    }
  }
}
```

Restart Claude Desktop after saving the file. On Windows, if Claude Desktop
cannot resolve `npx`, set `command` to `npx.cmd`.

## AI Test Studio Dashboard

Copy the environment template and add at least one provider key:

```bash
cp .env.example .env
```

```dotenv
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash
```

Build and start the local Dashboard:

```bash
npm run build
npm run dashboard
```

Open [http://127.0.0.1:3210](http://127.0.0.1:3210). The Dashboard lets you:

1. Enter the target website. The QA description is optional.
2. Select OpenAI or Google Gemini and choose a model.
3. Verify the API connection before generating content.
4. Let Playwright map visible fields and actions, then generate validated IT test cases from that context.
5. Open a target URL in the Playwright-powered browser viewport beside the case list.
6. Run an individual case and watch the rendered page update after every step.
7. Track running, passed, or failed states in real time, including timing and screenshot evidence.

When a plan is generated, Playwright first inspects the rendered page and sends
the AI a compact page map containing visible field labels, placeholders, input
types, required/disabled state, actions, and reusable selectors. This means the
tester can leave the description empty or provide only a short business goal.

An API key may also be entered temporarily in the Dashboard. A temporary key is
sent only to the local loopback backend for the current request and is not saved
to local storage or a file. For regular use, environment variables are
recommended.

The Dashboard binds to `127.0.0.1` by default. Do not expose it publicly without
adding authentication, TLS, origin controls, and network access restrictions.

### Supported generated actions

| Action | Behavior |
| --- | --- |
| `navigate` | Open an HTTP or HTTPS target. |
| `click` | Click the first matching element. |
| `type` | Fill a field with generated test data. |
| `scroll` | Scroll an element into view. |
| `assert_visible` | Verify that an element is visible. |
| `assert_text` | Verify that an element contains expected text. |
| `screenshot` | Capture a page or element screenshot. |

## Local development

```bash
npm install
npx playwright install chromium
npm run typecheck
npm run build
npm start
```

For development without building first:

```bash
npm run dev
```

## Tool examples

Navigate to a test target:

```json
{
  "url": "https://example.com"
}
```

Type into an input:

```json
{
  "action": "type",
  "selector": "input[name='email']",
  "text": "tester@example.com"
}
```

Capture a selected element:

```json
{
  "selector": "main"
}
```

Playwright accepts CSS selectors by default. Prefix XPath selectors with
`xpath=`, for example `xpath=//button[@type='submit']`.

## Architecture

```text
src/index.ts                 MCP transport and core MCP tools
src/dashboard.ts             Local Dashboard HTTP server and API routes
src/browser.ts               Playwright lifecycle and browser operations
src/test-runner.ts           Structured test-case execution engine
src/domain/test-case.ts      Shared Zod schemas and domain types
src/ai/provider.ts           AI provider abstraction and provider factory
src/ai/openai-provider.ts    OpenAI Responses API adapter
src/ai/gemini-provider.ts    Google GenAI adapter with transient-error retry
web/                         Browser UI assets
```

The MCP layer depends on the `BrowserController` abstraction, while all browser
lifecycle and interaction details remain isolated in `src/browser.ts`. Chromium
starts lazily on the first browser tool call and closes on `SIGINT` or `SIGTERM`.

## Build output

`npm run build` creates two executable entry points:

- `dist/index.js` — the stdio MCP server.
- `dist/dashboard.js` — the local AI Test Studio.

The MCP SDK and schema validation code are bundled. Playwright remains a runtime
dependency because its browser binaries and executable discovery are managed separately.

## License

Released under the [MIT License](LICENSE).
