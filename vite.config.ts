import { defineConfig } from 'vite';

// base relativa: funciona tanto em usuario.github.io/repositorio/ quanto num domínio próprio
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        analise: 'analise-2026/index.html',
      },
    },
  },
  // analise/ é a pasta local da análise (dezenas de GB de logs de urna): fora do watcher
  server: { watch: { ignored: ['**/analise/**'] } },
});
