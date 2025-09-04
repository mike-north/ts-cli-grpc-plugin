import * as eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    ignores: ["**/dist/**/*"],
  },
  {
    files: ["src/**/*.ts", "test/**/*.ts", "examples/**/*.ts", "ts-cli-plugin/bin/ts-cli-plugin"],
    rules: {},
  },
);
