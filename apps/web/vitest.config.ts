import { defineConfig } from "vitest/config";

// Config separada de vite.config.ts de propósito: os plugins do React Router e da Cloudflare
// só servem para build e dev, e atrapalhariam os testes unitários.
export default defineConfig({
  test: {
    include: ["app/**/*.test.{ts,tsx}", "workers/**/*.test.ts"],
    environment: "node",
  },
});
