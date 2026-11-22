import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["apps/patient-portal/**/*.{js,jsx,ts,tsx}"],
    plugins: {"@next/next": nextPlugin},
    rules: nextPlugin.configs.recommended.rules,
  },
  {
    files: ["tools/medicloud-agent-company/src/**/*.ts"],
    rules: { "@typescript-eslint/consistent-type-imports": "error" },
  },
);
