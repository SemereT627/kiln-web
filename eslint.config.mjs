import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // mSync must stay liftable into its own service (MSYNC.md): lib/msync
  // imports nothing from Kiln, and Kiln only enters through client.ts / live.ts.
  {
    files: ["lib/msync/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/*", "!@/lib/msync", "!@/lib/msync/*", "../*"], message: "lib/msync must not import host-app (Kiln) code." }],
      }],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["lib/msync/**", "app/api/msync/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/lib/msync/*", "!@/lib/msync/client", "!@/lib/msync/live"], message: "Kiln uses mSync only through @/lib/msync/client or @/lib/msync/live." }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
