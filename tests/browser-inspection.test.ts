import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";

import { BrowserController } from "../src/browser.js";

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
    <html lang="vi"><head><title>Trang đăng nhập mẫu</title></head><body>
      <label for="email">Email công việc</label>
      <input id="email" name="email" type="email" required />
      <textarea placeholder="Mô tả lỗi"></textarea>
      <button data-testid="submit-login">Đăng nhập</button>
    </body></html>`);
});

let targetUrl = "";

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start.");
  targetUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("inspectPage maps labelled fields and reusable action selectors", async () => {
  const browser = new BrowserController();
  try {
    await browser.navigate(targetUrl);
    const inspection = await browser.inspectPage();

    assert.equal(inspection.title, "Trang đăng nhập mẫu");
    assert.equal(inspection.inputAreas.length, 2);
    assert.equal(inspection.actions.length, 1);
    assert.deepEqual(
      inspection.inputAreas.map((item) => item.label),
      ["Email công việc", "Mô tả lỗi"],
    );
    assert.equal(inspection.inputAreas[0]?.selector, "#email");
    assert.equal(inspection.actions[0]?.selector, 'button[data-testid="submit-login"]');
  } finally {
    await browser.close();
  }
});
