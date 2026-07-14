import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
      // Last, so it disables any stylistic rules that would fight prettier.
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // This app is front-end only (no backend, static hosting - see
      // CLAUDE.md). `@types/node` is a dev dependency (added so a test could
      // read sample files off disk - `readRecord.samples.test.ts`), and
      // `tsconfig.app.json` has no `types` restriction, so a `node:*` import
      // would typecheck from anywhere in `src`. This rule is the actual
      // compile-time-adjacent guard: `node:*` imports are banned everywhere
      // except `*.test.ts` files, where reading fixtures off disk is
      // legitimate.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["node:*"],
              message:
                "This app is front-end only - Node built-ins may only be imported from *.test.ts files.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);
