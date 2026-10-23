/**
 * Vite plugin: bundles /content and /locales as `virtual:compound-content`.
 * Validates on every build and dev reload; content errors fail the build.
 */
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { loadAll } from '../src/content/load';
import { validateContent } from '../src/content/validate';

const ID = 'virtual:compound-content';
const RESOLVED = '\0' + ID;

export function contentPlugin(root = process.cwd()): Plugin {
  const watched = [join(root, 'content'), join(root, 'locales')];
  return {
    name: 'compound-content',
    resolveId(id) {
      return id === ID ? RESOLVED : undefined;
    },
    load(id) {
      if (id !== RESOLVED) return;
      const { content, locale, errors, files } = loadAll(root);
      files.forEach((f) => this.addWatchFile(f));
      const report = errors.length ? null : validateContent(content, locale);
      const all = [...errors, ...(report?.errors ?? [])];
      if (all.length) this.error(`Content has ${all.length} error(s):\n  ${all.join('\n  ')}`);
      if (report?.warnings.length) this.warn(`${report.warnings.length} content warning(s) — run npm run validate for details`);
      return `export default ${JSON.stringify({ content, locale })};`;
    },
    configureServer(server) {
      server.watcher.add(watched);
      const reload = (file: string) => {
        if (!watched.some((w) => file.startsWith(w))) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload);
      server.watcher.on('change', reload);
      server.watcher.on('unlink', reload);
    },
  };
}
