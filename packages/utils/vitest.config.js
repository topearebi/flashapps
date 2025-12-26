import { defineConfig } from 'vite';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node', // Utils are logic-only, usually node or jsdom is fine. Node is faster.
    },
});
