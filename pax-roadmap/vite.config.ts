import react from '@vitejs/plugin-react';
import stylexModule from '@stylexjs/rollup-plugin';

// The plugin ships CommonJS; unwrap its default export either way.
const stylex = ((stylexModule as unknown as {default?: typeof stylexModule}).default ?? stylexModule) as unknown as (o: Record<string, unknown>) => import('vite').PluginOption;
import {defineConfig, type Plugin} from 'vite';

// Run StyleX only on this app's .ts/.tsx files, never on CSS or node_modules.
function onlyOwnSource(p: unknown): Plugin {
  const plugin = p as Plugin & {transform?: (...a: unknown[]) => unknown};
  const inner = plugin.transform;
  if (typeof inner !== 'function') return plugin;
  return {
    ...plugin,
    transform(this: unknown, code: unknown, id: unknown, ...rest: unknown[]) {
      const file = String(id);
      if (!/\/src\/.*\.tsx?$/.test(file) || file.includes('node_modules')) return null;
      return inner.call(this, code, id, ...rest);
    },
  } as Plugin;
}
import {viteSingleFile} from 'vite-plugin-singlefile';

// StyleX compiles only this app's own source (the page template uses
// stylex.create for layout); Astryx components come from the prebuilt CSS.
export default defineConfig({
  plugins: [
    react(),
    onlyOwnSource(
      stylex({
        fileName: 'stylex.css',
        useCSSLayers: true,
        unstable_moduleResolution: {type: 'commonJS', rootDir: process.cwd()},
      }),
    ),
    viteSingleFile(),
  ],
  build: {cssCodeSplit: false, assetsInlineLimit: 100_000_000},
});
