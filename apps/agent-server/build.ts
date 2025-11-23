/// <reference types="bun-types" />

// Build with Bun
await Bun.build({
  entrypoints: ['./src/index.ts', './src/server.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  sourcemap: 'external',
  splitting: true,
  minify: false,
});

// Generate type declarations
import { execSync } from 'node:child_process';
execSync('tsc --emitDeclarationOnly --declaration --outDir dist', {
  stdio: 'inherit',
});

console.log('✅ Build complete');
