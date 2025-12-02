// source.config.ts
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
var docs = defineDocs({
  dir: "../../docs"
});
var source_config_default = defineConfig({
  mdxOptions: {
    // MDX options can be added here
  }
});
export {
  source_config_default as default,
  docs
};
