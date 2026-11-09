import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // lint 대상에서 제외: 빌드 산출물, 의존성, 하네스/사용자 파일
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "scripts/**",
    "harness_framework/**",
    "life-calendar.html",
    "next-env.d.ts",
  ]),
]);
