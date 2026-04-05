import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      ".next/**",
      ".vercel/**",
      "coverage/**",
      "node_modules/**",
      "playwright-report/**",
      "temp/**",
      "test-results/**"
    ]
  },
  ...nextVitals,
  ...nextTypescript
];

export default config;
