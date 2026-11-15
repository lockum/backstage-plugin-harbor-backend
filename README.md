# Backstage Harbor Backend Plugin

[![npm version](https://img.shields.io/npm/v/@lockum/backstage-plugin-harbor-backend.svg)](https://www.npmjs.com/package/@lockum/backstage-plugin-harbor-backend)

The Harbor Backend Plugin acts as the API bridge between your Backstage instance and [CNCF Harbor](https://goharbor.io/) registry instances. It queries the Harbor API v2.0 to fetch container artifacts, tags, digest information, and vulnerability reports.

> This repository is a fork of [`container-registry/backstage-plugin-harbor-backend`](https://github.com/container-registry/backstage-plugin-harbor-backend) updated for modern Backstage versions, featuring full support for **multi-path / nested repositories** (`project/subproject/repo`, `project/path1/path2/repo`), robust URL encoding, multi-instance Harbor routing, and compatibility with the **New Backstage Backend System**.

---

## Features

- **New Backend System Compatible**: Seamless integration with Backstage 1.29+ via `backend.add(import(...))`.
- **Legacy Backend System Compatible**: Includes router factory function `createRouter(...)` for older Backstage setups.
- **Full Multi-Path Repository Support**: Proper double URL-encoding (`%252F`) for Harbor v2.0 REST endpoints, enabling nested repositories of any depth.
- **Multi-Instance Harbor Routing**: Query different Harbor clusters per entity based on hostname matching.
- **Defensive Fallback**: Automatically resolves multi-segment repository slugs even if called by older frontends.
- **Optional Redis Caching**: Cache Harbor search results to optimize performance and rate limits.

---

## Getting Started

### 1. Install the Backend Package

In your Backstage root directory:

```bash
# Using Yarn directly from your repository fork
yarn --cwd packages/backend add git+https://github.com/lockum/backstage-plugin-harbor-backend.git
```

---

### 2. Register the Plugin in Your Backend

#### Option A: New Backend System (Backstage 1.24+ / Recommended)

In `packages/backend/src/index.ts`:

```ts
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// ... other plugins ...

// Add Harbor Backend plugin
backend.add(import('@lockum/backstage-plugin-harbor-backend'));

backend.start();
```

#### Option B: Legacy Backend System

Create `packages/backend/src/plugins/harbor.ts`:

```ts
import { createRouter } from '@lockum/backstage-plugin-harbor-backend';
import { Router } from 'express';
import { PluginEnvironment } from '../types';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  return await createRouter({
    logger: env.logger,
    config: env.config,
    auth: env.auth,
    httpAuth: env.httpAuth,
  });
}
```

Then in `packages/backend/src/index.ts` (legacy):

```ts
import harbor from './plugins/harbor';

// In createEnv or router registration:
const harborEnv = useHotMemoize(previous => createEnv('harbor'));
apiRouter.use('/harbor', await harbor(harborEnv));
```

---

## Configuration (`app-config.yaml`)

Configure the connection to your Harbor instance(s) in `app-config.yaml`:

### Single Default Harbor Instance

```yaml
harbor:
  baseUrl: https://harbor.yourdomain.com
  username: ${HARBOR_USERNAME}
  password: ${HARBOR_PASSWORD}
```

### Multiple Harbor Instances

You can configure multiple Harbor instances and reference them by host in your catalog entities:

```yaml
harbor:
  # Default instance (used when no host is specified in the entity slug)
  baseUrl: https://harbor.yourdomain.com
  username: ${HARBOR_USERNAME}
  password: ${HARBOR_PASSWORD}

  # Additional instances matched by host
  instances:
    - host: harbor2.yourdomain.com
      baseUrl: https://harbor2.yourdomain.com
      username: ${HARBOR2_USERNAME}
      password: ${HARBOR2_PASSWORD}

    - host: harbor-internal:8443
      baseUrl: https://harbor-internal:8443
      username: ${HARBOR_INTERNAL_USERNAME}
      password: ${HARBOR_INTERNAL_PASSWORD}

  # Optional Redis caching for search operations
  redis:
    host: 127.0.0.1
    port: 6379
```

### Recommended Harbor Credentials

We recommend using a **Harbor Robot Account** with read-only permissions:
- Project permissions: `Repository: Pull / Read`, `Artifact: Read`

---

## Configuring Catalog Entities (`catalog-info.yaml`)

Annotate your component using `goharbor.io/repository-slug`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: sample-service
  description: A sample service tracked in Harbor
  annotations:
    # 1. Standard two-segment repository (uses default Harbor instance)
    goharbor.io/repository-slug: project/repository

    # 2. Multi-path / nested repository (3 segments)
    # goharbor.io/repository-slug: project/subproject/repository

    # 3. Deeply nested repository (4+ segments)
    # goharbor.io/repository-slug: project/path1/path2/repository

    # 4. Multi-instance: Route to a specific host configured in app-config.yaml
    # goharbor.io/repository-slug: harbor2.yourdomain.com/project/repository

    # 5. Multi-instance with nested repository
    # goharbor.io/repository-slug: harbor2.yourdomain.com/project/path1/path2/repository

    # 6. Multiple repositories (comma-separated list)
    # goharbor.io/repository-slug: project/repository, harbor2.yourdomain.com/other-project/nested/repo
spec:
  type: service
  lifecycle: production
  owner: team-a
```

---

## API Endpoints

The backend plugin exposes the following endpoints under `/api/harbor`:

- `GET /artifacts`: Retrieves artifacts, tags, and vulnerability summaries for a repository.
  - Query parameters:
    - `project`: Harbor project name
    - `repository`: Repository name (supports multi-path, e.g. `sub/repo`)
    - `host` *(optional)*: Harbor instance host
    - `slug` *(optional)*: Full repository slug (e.g. `harbor.domain.com/proj/sub/repo` or `proj/sub/repo`)
- `POST /search`: Searches for repositories across Harbor instances (supports Redis caching).
- `GET /health`: Health check endpoint (returns `{ status: 'ok' }`).

---

## Contributing

Contributions, bug reports, and pull requests are welcome!

Please also consider contributing back upstream to the original repository at [container-registry/backstage-plugin-harbor-backend](https://github.com/container-registry/backstage-plugin-harbor-backend).

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
