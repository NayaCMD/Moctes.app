import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import type { Plugin } from "vite";

export default defineConfig({
  plugins: [preferWoff2EmojiFont(), react(), tailwindcss()],
  server: {
    port: 5173,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    css: true,
    restoreMocks: true,
    clearMocks: true,
  },
});

function preferWoff2EmojiFont(): Plugin {
  return {
    name: "moctes-woff2-emoji-font",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("@fontsource/noto-color-emoji/index.css")) return;
      return code.replace(
        /,\s*url\((\.\/files\/[^)]+\.woff)\)\s*format\((['"])woff\2\)/g,
        "",
      );
    },
  };
}
