import { defineProject } from "vitest/config";
import { readFileSync } from "node:fs";

export default defineProject({
  test: {
    name: "prompts",
    include: ["src/**/*.test.ts"],
  },
  plugins: [
    {
      name: "raw-md-loader",
      load(id) {
        if (id.endsWith(".md")) {
          const content = readFileSync(id, "utf-8");
          return `export default ${JSON.stringify(content)};`;
        }
      },
    },
  ],
});
