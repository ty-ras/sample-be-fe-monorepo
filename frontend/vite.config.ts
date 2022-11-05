import { defineConfig, UserConfigExport } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

const config: UserConfigExport = {
  plugins: [
    react(), 
    tsconfigPaths(),
  ],
  clearScreen: false,
};

// Notice that we can't do basic Node platform check.
// At this point we are already inside Docker and platform will be "Linux".
if ((process.env.TYRAS_NODEMON_ARGS?.indexOf("--legacy-watch") ?? -1) >= 0) {
  // In Windows, HRM doesn't work in Docker without this
  config.server = {
    watch: {
      usePolling: true,
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(config);
