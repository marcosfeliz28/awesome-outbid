# Dependencias declaradas sin uso aparente (S3, tanda 3)

Borrador sin verificar. Fuente: `origin/producto-nexora` (`d6adc554`), rama `claude-pc/lote-local-tanda3`. Por cada dependencia de cada `package.json` (dependencies y devDependencies), búsqueda del nombre del paquete en `import`/`require`/`from` sobre apps, packages, tests y scripts, con `git grep -l`. **Cada fila dice «posible, verificar»** cuando no hay uso: puede usarse en configuración, CLI o tipos. No sugiere eliminar nada.

| Paquete | Declarado en | Archivos que lo importan | Estado |
|---|---|---|---|
| `@anthropic-ai/sdk` | `apps/api/package.json` | 4 | usado |
| `@aws-sdk/client-s3` | `apps/api/package.json` | 1 | usado |
| `@capacitor/android` | `apps/web/package.json` | 0 | posible, verificar |
| `@capacitor/cli` | `apps/web/package.json` | 1 | usado |
| `@capacitor/core` | `apps/web/package.json` | 0 | posible, verificar |
| `@capacitor/ios` | `apps/web/package.json` | 0 | posible, verificar |
| `@eslint/js` | `package.json` | 0 | posible, verificar |
| `@fitstore/shared` | `apps/api/package.json` | 73 | usado |
| `@fitstore/shared` | `apps/web/package.json` | 73 | usado |
| `@fitstore/ui` | `apps/web/package.json` | 30 | usado |
| `@fontsource-variable/inter` | `apps/web/package.json` | 0 | posible, verificar |
| `@fontsource-variable/jetbrains-mono` | `apps/web/package.json` | 0 | posible, verificar |
| `@fontsource-variable/plus-jakarta-sans` | `apps/web/package.json` | 0 | posible, verificar |
| `@nestjs/common` | `apps/api/package.json` | 50 | usado |
| `@nestjs/core` | `apps/api/package.json` | 3 | usado |
| `@nestjs/jwt` | `apps/api/package.json` | 5 | usado |
| `@nestjs/platform-express` | `apps/api/package.json` | 6 | usado |
| `@nestjs/swagger` | `apps/api/package.json` | 1 | usado |
| `@playwright/test` | `package.json` | 29 | usado |
| `@prisma/client` | `apps/api/package.json` | 33 | usado |
| `@radix-ui/react-dialog` | `packages/ui/package.json` | 1 | usado |
| `@sentry/node` | `apps/api/package.json` | 2 | usado |
| `@sentry/react` | `apps/web/package.json` | 1 | usado |
| `@tailwindcss/vite` | `apps/web/package.json` | 1 | usado |
| `@tanstack/react-query` | `apps/web/package.json` | 35 | usado |
| `@tauri-apps/api` | `apps/web/package.json` | 1 | usado |
| `@tauri-apps/cli` | `apps/web/package.json` | 0 | posible, verificar |
| `@types/cookie-parser` | `apps/api/package.json` | 0 | posible, verificar |
| `@types/express` | `apps/api/package.json` | 0 | posible, verificar |
| `@types/node` | `apps/api/package.json` | 0 | posible, verificar |
| `@types/node` | `apps/web/package.json` | 0 | posible, verificar |
| `@types/node` | `package.json` | 0 | posible, verificar |
| `@types/pdfkit` | `apps/api/package.json` | 0 | posible, verificar |
| `@types/react-dom` | `apps/web/package.json` | 0 | posible, verificar |
| `@types/react` | `apps/web/package.json` | 0 | posible, verificar |
| `@types/react` | `packages/ui/package.json` | 0 | posible, verificar |
| `@types/supertest` | `package.json` | 0 | posible, verificar |
| `@vitejs/plugin-react` | `apps/web/package.json` | 1 | usado |
| `@zxing/browser` | `apps/web/package.json` | 2 | usado |
| `bcryptjs` | `apps/api/package.json` | 9 | usado |
| `concurrently` | `package.json` | 0 | posible, verificar |
| `cookie-parser` | `apps/api/package.json` | 1 | usado |
| `decimal.js` | `packages/shared/package.json` | 1 | usado |
| `dexie` | `apps/web/package.json` | 1 | usado |
| `dotenv` | `apps/api/package.json` | 7 | usado |
| `embedded-postgres` | `package.json` | 47 | usado |
| `eslint` | `package.json` | 0 | posible, verificar |
| `exceljs` | `apps/api/package.json` | 9 | usado |
| `express` | `apps/api/package.json` | 26 | usado |
| `express` | `package.json` | 26 | usado |
| `helmet` | `apps/api/package.json` | 1 | usado |
| `lucide-react` | `apps/web/package.json` | 16 | usado |
| `lucide-react` | `packages/ui/package.json` | 16 | usado |
| `pdfkit` | `apps/api/package.json` | 6 | usado |
| `prettier` | `package.json` | 0 | posible, verificar |
| `prisma` | `apps/api/package.json` | 1 | usado |
| `react-dom` | `apps/web/package.json` | 14 | usado |
| `react` | `apps/web/package.json` | 52 | usado |
| `react` | `packages/ui/package.json` | 52 | usado |
| `recharts` | `apps/web/package.json` | 3 | usado |
| `reflect-metadata` | `apps/api/package.json` | 0 | posible, verificar |
| `rxjs` | `apps/api/package.json` | 1 | usado |
| `supertest` | `package.json` | 34 | usado |
| `tailwindcss` | `apps/web/package.json` | 0 | posible, verificar |
| `tsx` | `apps/api/package.json` | 0 | posible, verificar |
| `typescript-eslint` | `package.json` | 0 | posible, verificar |
| `typescript` | `apps/api/package.json` | 0 | posible, verificar |
| `typescript` | `apps/web/package.json` | 0 | posible, verificar |
| `typescript` | `package.json` | 0 | posible, verificar |
| `vite-plugin-pwa` | `apps/web/package.json` | 1 | usado |
| `vite` | `apps/web/package.json` | 1 | usado |
| `vitest` | `package.json` | 260 | usado |
| `workbox-window` | `apps/web/package.json` | 0 | posible, verificar |
| `zod` | `apps/api/package.json` | 7 | usado |
| `zod` | `packages/shared/package.json` | 7 | usado |
| `zustand` | `apps/web/package.json` | 3 | usado |
