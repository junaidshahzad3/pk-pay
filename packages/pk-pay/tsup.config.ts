import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'middleware/express/index': 'src/middleware/express/index.ts',
    'middleware/fastify/index': 'src/middleware/fastify/index.ts',
    'middleware/nextjs/index': 'src/middleware/nextjs/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  external: ['stripe'],
});
