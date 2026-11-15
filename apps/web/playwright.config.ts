import { defineConfig, devices } from "@playwright/test";

const PORTA = 4173;

/**
 * No CI o Chromium vem de `playwright install`. Em máquinas que já têm um Chromium instalado,
 * aponte para ele com PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH (nunca baixamos navegador sozinhos).
 */
const executavel = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"];

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: process.env["CI"] !== undefined,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${String(PORTA)}`,
    trace: "off",
    ...devices["Desktop Chrome"],
    launchOptions: executavel === undefined ? {} : { executablePath: executavel },
  },
  webServer: {
    // Testa o build de produção rodando no runtime de Workers (workerd), igual ao deploy.
    command: `react-router build && vite preview --port ${String(PORTA)} --strictPort`,
    url: `http://localhost:${String(PORTA)}/privacidade`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Usa o ambiente "teste" do wrangler.jsonc (variáveis de mentira do Access).
      CLOUDFLARE_ENV: "teste",
    },
  },
});
