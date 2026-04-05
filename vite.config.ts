import { defineConfig } from 'vite';

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
});
