import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  // `dist/` é a pasta de saída de todo o monorepo (turbo.json, .gitignore, lint).
  buildDirectory: "dist",
  future: {
    // Exigido pelo plugin Vite da Cloudflare: o servidor roda no ambiente "ssr" do Vite,
    // dentro do runtime de Workers, igual à produção.
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
