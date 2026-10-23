import { performance } from "node:perf_hooks";

import { BrowserController } from "./browser.js";
import type { TestCase, TestStep } from "./domain/test-case.js";

export interface StepRunResult {
  stepId: string;
  action: TestStep["action"];
  status: "passed" | "failed";
  message: string;
  durationMs: number;
  screenshotDataUrl?: string;
  browserScreenshotDataUrl?: string;
  pageUrl?: string;
}

export interface TestCaseRunResult {
  testCaseId: string;
  status: "passed" | "failed";
  durationMs: number;
  steps: StepRunResult[];
}

export class TestCaseRunner {
  async run(
    testCase: TestCase,
    targetUrl: string,
    onStep?: (result: StepRunResult, index: number) => void | Promise<void>,
  ): Promise<TestCaseRunResult> {
    const browser = new BrowserController();
    const startedAt = performance.now();
    const results: StepRunResult[] = [];

    try {
      if (testCase.steps[0]?.action !== "navigate") {
        await browser.navigate(targetUrl);
      }

      for (const [index, step] of testCase.steps.entries()) {
        const result = await this.runStep(browser, step, targetUrl);

        // Cập nhật browser viewport sau mọi bước để UI phản ánh đúng trạng thái
        // trang mà Playwright đang thao tác, kể cả khi bước vừa thất bại.
        try {
          result.pageUrl = await browser.currentUrl();
          const viewport = await browser.screenshot({ fullPage: false });
          result.browserScreenshotDataUrl = `data:image/png;base64,${viewport.toString("base64")}`;
        } catch {
          // Lỗi chụp evidence không được che khuất kết quả thật của test step.
        }

        results.push(result);
        await onStep?.(result, index);
        if (result.status === "failed") {
          break;
        }
      }
    } finally {
      await browser.close();
    }

    return {
      testCaseId: testCase.id,
      status: results.every((step) => step.status === "passed") ? "passed" : "failed",
      durationMs: Math.round(performance.now() - startedAt),
      steps: results,
    };
  }

  private async runStep(
    browser: BrowserController,
    step: TestStep,
    targetUrl: string,
  ): Promise<StepRunResult> {
    const startedAt = performance.now();

    try {
      let message: string;
      let screenshotDataUrl: string | undefined;

      switch (step.action) {
        case "navigate": {
          const navigation = await browser.navigate(step.value ?? targetUrl);
          message = `Đã mở ${navigation.url} (HTTP ${navigation.status ?? "n/a"}).`;
          break;
        }
        case "click":
        case "type":
        case "scroll":
          if (!step.selector) {
            throw new Error(`Action ${step.action} requires a selector.`);
          }
          message = await browser.interact({
            action: step.action,
            selector: step.selector,
            text: step.value ?? undefined,
          });
          break;
        case "assert_visible":
          if (!step.selector) {
            throw new Error("assert_visible requires a selector.");
          }
          if (!(await browser.isVisible(step.selector))) {
            throw new Error(`Element is not visible: ${step.selector}`);
          }
          message = `Element is visible: ${step.selector}`;
          break;
        case "assert_text": {
          if (!step.selector || step.value === null) {
            throw new Error("assert_text requires selector and value.");
          }
          const actualText = await browser.textContent(step.selector);
          if (!actualText.includes(step.value)) {
            throw new Error(
              `Expected text ${JSON.stringify(step.value)}, received ${JSON.stringify(actualText)}.`,
            );
          }
          message = `Text assertion passed for: ${step.selector}`;
          break;
        }
        case "screenshot": {
          const image = await browser.screenshot({ selector: step.selector ?? undefined });
          screenshotDataUrl = `data:image/png;base64,${image.toString("base64")}`;
          message = `Captured ${image.byteLength} bytes.`;
          break;
        }
      }

      return {
        stepId: step.id,
        action: step.action,
        status: "passed",
        message,
        durationMs: Math.round(performance.now() - startedAt),
        ...(screenshotDataUrl ? { screenshotDataUrl } : {}),
      };
    } catch (error) {
      return {
        stepId: step.id,
        action: step.action,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
        durationMs: Math.round(performance.now() - startedAt),
      };
    }
  }
}
