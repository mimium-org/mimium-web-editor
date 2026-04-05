import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const mimiumDistDir = path.resolve('node_modules/@mimium/mimium-webaudio/dist');
const processorFile = 'audioprocessor.mjs';

async function collectMimiumWorkletFiles(): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  const processorPath = path.join(mimiumDistDir, processorFile);
  const processorSource = await readFile(processorPath, 'utf8');
  files.set(processorFile, Buffer.from(processorSource));

  const importMatches = [...processorSource.matchAll(/import\s+[^"']*["']\.\/([^"']+)["']/g)];
  const dependencies = [...new Set(importMatches.map((m) => m[1]))];

  await Promise.all(
    dependencies.map(async (fileName) => {
      const filePath = path.join(mimiumDistDir, fileName);
      files.set(fileName, await readFile(filePath));
    }),
  );

  return files;
}

function mimiumWorkletAssetsPlugin(): Plugin {
  return {
    name: 'mimium-worklet-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/assets', async (req, res, next) => {
        try {
          const reqPath = req.url?.split('?')[0] ?? '';
          const fileName = reqPath.replace(/^\//, '');
          if (!fileName) {
            return next();
          }

          const files = await collectMimiumWorkletFiles();
          const content = files.get(fileName);
          if (!content) {
            return next();
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.end(content);
        } catch {
          next();
        }
      });
    },
  };
}

function mimiumWorkletAssetsBuildPlugin(): Plugin {
  return {
    name: 'mimium-worklet-assets-build',
    apply: 'build',
    async generateBundle() {
      const files = await collectMimiumWorkletFiles();
      for (const [fileName, source] of files.entries()) {
        this.emitFile({
          type: 'asset',
          fileName: `assets/${fileName}`,
          source,
        });
      }
    },
  };
}

function resolveBasePath(): string {
  const repository = process.env.GITHUB_REPOSITORY;
  const isActions = process.env.GITHUB_ACTIONS === 'true';

  // Keep local/dev builds on root. Use project path only for GitHub Actions Pages builds.
  if (!isActions || !repository) {
    return '/';
  }

  const repoName = repository.split('/')[1] || '';

  // User/Org Pages repository (e.g. owner.github.io) is served from root.
  if (repoName.endsWith('.github.io')) {
    return '/';
  }

  return `/${repoName}/`;
}

export default defineConfig({
  base: resolveBasePath(),
  plugins: [mimiumWorkletAssetsPlugin(), mimiumWorkletAssetsBuildPlugin()],
});
