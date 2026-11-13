import { defineConfig } from 'vite';

// Multi-page build: every HTML file listed here is built and served.
// When you add project-4.html, add it to this list too.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        project1: 'project-1.html',
        project2: 'project-2.html',
        project3: 'project-3.html',
      },
    },
  },
});
