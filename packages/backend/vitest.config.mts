import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    // Os testes de integração compartilham o mesmo banco: nada de arquivos em paralelo
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
  },
});
