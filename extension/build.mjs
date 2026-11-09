/**
 * Build da extensão com esbuild: gera `dist/` pronto para "Carregar sem compactação" no Brave.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */
import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const outdir = 'dist';
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const common = {
  bundle: true,
  target: 'chrome116',
  sourcemap: true,
  logLevel: 'info',
  legalComments: 'none',
  minify: true,
};
await Promise.all([
  build({
    ...common,
    entryPoints: ['src/background.ts'],
    outfile: `${outdir}/background.js`,
    format: 'esm',
  }),
  build({
    ...common,
    entryPoints: ['src/content.ts'],
    outfile: `${outdir}/content.js`,
    format: 'iife',
  }),
  build({
    ...common,
    entryPoints: ['src/page-bridge.ts'],
    outfile: `${outdir}/page-bridge.js`,
    format: 'iife',
  }),
  build({
    ...common,
    entryPoints: ['src/options.ts'],
    outfile: `${outdir}/options.js`,
    format: 'iife',
  }),
]);
await cp('static', outdir, { recursive: true });
