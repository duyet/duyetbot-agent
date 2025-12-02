import { defineConfig, defineDocs } from 'fumadocs-mdx/config';

export const docs = defineDocs({
  dir: '../../docs',
});

export default defineConfig({
  mdxOptions: {
    // MDX options can be added here
  },
});
