import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/dashboard.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  bundle: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Playwright tải browser binary riêng và dùng đường dẫn động ở runtime.
  // Externalize package này để bundle không làm hỏng cơ chế tìm executable.
  external: ["playwright"],
  noExternal: ["@modelcontextprotocol/sdk", "zod"],
});
