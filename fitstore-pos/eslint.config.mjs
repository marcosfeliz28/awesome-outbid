import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      ".local-db/**",
      "playwright-report/**",
      "test-results/**",
      "apps/web/src-tauri/target/**",
      // Reproducciones externas de ChatGPT, guardadas tal cual como evidencia.
      "docs/validacion/auditoria-ronda4-reproducciones/**",
      "docs/validacion/auditoria-ronda6-reproducciones/**",
      "docs/validacion/auditoria-ronda7-reproducciones/**",
      "docs/validacion/auditoria-ronda8-reproducciones/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
    },
  },
  {
    files: ["scripts/*.mjs", "docs/validacion/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        setInterval: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        fetch: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
      },
    },
  },
);
