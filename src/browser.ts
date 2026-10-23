import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export const PROJECT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36 " +
  "(MCP-Browser-Testing-Bot/1.0; OpenSource-Disclaimer-Applied)";

export type BrowserAction = "click" | "type" | "scroll";

export interface NavigationResult {
  url: string;
  title: string;
  status: number | null;
}

export interface InteractionInput {
  action: BrowserAction;
  selector: string;
  text?: string;
}

export interface ScreenshotInput {
  fullPage?: boolean;
  selector?: string;
}

export interface PageElementDescriptor {
  id: string;
  kind: "input" | "textarea" | "select" | "button" | "link" | "editable";
  label: string;
  selector: string;
  inputType: string | null;
  placeholder: string | null;
  required: boolean;
  disabled: boolean;
}

export interface PageInspection {
  url: string;
  title: string;
  inputAreas: PageElementDescriptor[];
  actions: PageElementDescriptor[];
}

/**
 * Quản lý một browser session dùng chung giữa các MCP tool calls.
 * Browser được khởi tạo lazy để việc kết nối MCP không tự động mở Chromium.
 */
export class BrowserController {
  private browser: Browser | undefined;
  private context: BrowserContext | undefined;
  private page: Page | undefined;
  private initialization: Promise<Page> | undefined;

  private async createPage(): Promise<Page> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: PROJECT_USER_AGENT,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    this.browser = browser;
    this.context = context;
    this.page = page;

    browser.on("disconnected", () => {
      this.browser = undefined;
      this.context = undefined;
      this.page = undefined;
    });

    return page;
  }

  private async getPage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    // Khóa bằng Promise để hai tool calls đồng thời không mở hai browser riêng.
    this.initialization ??= this.createPage().finally(() => {
      this.initialization = undefined;
    });

    return this.initialization;
  }

  async navigate(url: string): Promise<NavigationResult> {
    const target = new URL(url);
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new Error("Only http:// and https:// URLs are supported.");
    }

    const page = await this.getPage();
    const response = await page.goto(target.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    return {
      url: page.url(),
      title: await page.title(),
      status: response?.status() ?? null,
    };
  }

  async interact(input: InteractionInput): Promise<string> {
    const page = await this.getPage();
    const locator = page.locator(input.selector).first();

    switch (input.action) {
      case "click":
        await locator.click({ timeout: 15_000 });
        return `Clicked element: ${input.selector}`;

      case "type":
        if (input.text === undefined) {
          throw new Error('The "text" field is required when action is "type".');
        }
        // fill() thay thế nội dung cũ và vẫn tận dụng auto-wait của Playwright.
        await locator.fill(input.text, { timeout: 15_000 });
        return `Typed text into element: ${input.selector}`;

      case "scroll":
        await locator.scrollIntoViewIfNeeded({ timeout: 15_000 });
        return `Scrolled element into view: ${input.selector}`;
    }
  }

  async screenshot(input: ScreenshotInput): Promise<Buffer> {
    const page = await this.getPage();

    if (input.selector) {
      return page.locator(input.selector).first().screenshot({
        type: "png",
        timeout: 15_000,
      });
    }

    return page.screenshot({
      type: "png",
      fullPage: input.fullPage ?? true,
    });
  }

  async isVisible(selector: string): Promise<boolean> {
    const page = await this.getPage();
    return page.locator(selector).first().isVisible();
  }

  async textContent(selector: string): Promise<string> {
    const page = await this.getPage();
    const text = await page.locator(selector).first().textContent({ timeout: 15_000 });
    return text?.trim() ?? "";
  }

  async currentUrl(): Promise<string> {
    const page = await this.getPage();
    return page.url();
  }

  async inspectPage(): Promise<PageInspection> {
    const page = await this.getPage();
    const elements = await page
      .locator(
        'input, textarea, select, button, a[href], [contenteditable="true"], [role="textbox"], [role="button"]',
      )
      .evaluateAll((nodes) => {
        return nodes.flatMap((node, index) => {
          const element = node as HTMLElement;
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          const visible =
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) > 0 &&
            rect.width > 0 &&
            rect.height > 0;
          if (!visible) return [];

          let selector = "";
          if (element.id) {
            const candidate = `#${CSS.escape(element.id)}`;
            if (document.querySelectorAll(candidate).length === 1) selector = candidate;
          }

          if (!selector) {
            for (const attribute of ["data-testid", "data-test", "data-qa", "name"] as const) {
              const value = element.getAttribute(attribute);
              if (!value) continue;
              const escaped = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
              const candidate = `${element.tagName.toLowerCase()}[${attribute}="${escaped}"]`;
              if (document.querySelectorAll(candidate).length === 1) {
                selector = candidate;
                break;
              }
            }
          }

          const placeholder = element.getAttribute("placeholder");
          if (!selector && placeholder) {
            const escaped = placeholder.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
            const candidate = `${element.tagName.toLowerCase()}[placeholder="${escaped}"]`;
            if (document.querySelectorAll(candidate).length === 1) selector = candidate;
          }

          if (!selector) {
            const path: string[] = [];
            let current: Element | null = element;
            while (current && current !== document.body) {
              const parent: Element | null = current.parentElement;
              if (!parent) break;
              const tag = current.tagName.toLowerCase();
              const currentTag = current.tagName;
              const siblings = [...parent.children].filter((child) => child.tagName === currentTag);
              path.unshift(
                siblings.length > 1
                  ? `${tag}:nth-of-type(${siblings.indexOf(current) + 1})`
                  : tag,
              );
              const candidate = path.join(" > ");
              if (document.querySelectorAll(candidate).length === 1) {
                selector = candidate;
                break;
              }
              current = parent;
            }
            selector ||= path.join(" > ");
          }

          let label = element.getAttribute("aria-label")?.trim() ?? "";
          const labelledBy = element.getAttribute("aria-labelledby");
          if (!label && labelledBy) {
            label = labelledBy
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
              .filter(Boolean)
              .join(" ");
          }
          if (!label && element.id) {
            label =
              document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent?.trim() ??
              "";
          }
          label ||= element.closest("label")?.textContent?.trim() ?? "";
          label ||=
            placeholder ??
            element.getAttribute("title") ??
            element.textContent?.trim() ??
            element.getAttribute("name") ??
            "Unlabelled element";

          const tag = element.tagName.toLowerCase();
          const role = element.getAttribute("role");
          const kind =
            tag === "textarea"
              ? "textarea"
              : tag === "select"
                ? "select"
                : tag === "button" || role === "button"
                  ? "button"
                  : tag === "a"
                    ? "link"
                    : element.isContentEditable
                      ? "editable"
                      : "input";

          return [
            {
              id: `${kind}_${index + 1}`,
              kind,
              label: label.slice(0, 160),
              selector,
              inputType: tag === "input" ? element.getAttribute("type") ?? "text" : null,
              placeholder: element.getAttribute("placeholder"),
              required: element.hasAttribute("required") || element.getAttribute("aria-required") === "true",
              disabled: element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true",
            },
          ];
        });
      });

    const inputKinds = new Set(["input", "textarea", "select", "editable"]);
    return {
      url: page.url(),
      title: await page.title(),
      inputAreas: elements.filter((element) => inputKinds.has(element.kind)),
      actions: elements.filter((element) => !inputKinds.has(element.kind)),
    } as PageInspection;
  }

  async close(): Promise<void> {
    const browser = this.browser;
    this.browser = undefined;
    this.context = undefined;
    this.page = undefined;

    await browser?.close();
  }
}
