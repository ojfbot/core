# Build from the repository root so the workspace lockfile and TypeScript config stay canonical.
FROM node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS build

ARG CLEAN_RUN=default
ENV COREPACK_HOME=/tmp/corepack
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/fleet-runner/package.json packages/fleet-runner/LICENSE packages/fleet-runner/README.md packages/fleet-runner/deployment.md packages/fleet-runner/tsconfig.json ./packages/fleet-runner/
COPY packages/fleet-runner/src/ ./packages/fleet-runner/src/
COPY packages/fleet-runner/scripts/ ./packages/fleet-runner/scripts/

RUN pnpm config set store-dir "/tmp/pnpm-store-${CLEAN_RUN}" \
 && pnpm install --filter core-workflow-framework --filter @core/fleet-runner --frozen-lockfile --ignore-scripts \
 && pnpm --filter @core/fleet-runner build \
 && rm -rf "/tmp/pnpm-store-${CLEAN_RUN}"

FROM build AS proof
RUN mkdir -p /proof-output \
 && pnpm list --depth Infinity --json --filter core-workflow-framework --filter @core/fleet-runner > /tmp/dependencies.json \
 && node packages/fleet-runner/scripts/write-build-manifest.mjs /workspace /tmp/dependencies.json /proof-output/build-manifest.json \
 && node --input-type=module -e 'import { readFileSync, writeFileSync } from "node:fs"; const manifest = JSON.parse(readFileSync("/proof-output/build-manifest.json", "utf8")); writeFileSync("/proof-output/dependencies.json", JSON.stringify(manifest.dependencies, null, 2) + "\n");' \
 && pnpm --dir packages/fleet-runner pack --pack-destination /proof-output \
 && node --input-type=module -e 'import { mkdirSync, writeFileSync } from "node:fs"; mkdirSync("/tmp/fleet-consumer", { recursive: true }); writeFileSync("/tmp/fleet-consumer/package.json", JSON.stringify({ name: "fleet-runner-proof-consumer", private: true, type: "module" }) + "\n");' \
 && pnpm --dir /tmp/fleet-consumer add /proof-output/core-fleet-runner-0.1.0.tgz --ignore-scripts \
 && (cd /tmp/fleet-consumer && node --input-type=module -e 'import { fleetClient } from "@core/fleet-runner/client"; import { runWorker } from "@core/fleet-runner/worker"; if (typeof fleetClient !== "function" || typeof runWorker !== "function") process.exit(1); console.log(JSON.stringify({ installed: true, clientExport: typeof fleetClient, workerExport: typeof runWorker }));' > /proof-output/package-consumer.json) \
 && cp packages/fleet-runner/scripts/write-build-manifest.mjs /proof-output/write-build-manifest.mjs

FROM scratch AS proof-export
COPY --from=proof /proof-output/ /

FROM node:24.22.2-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS runtime
ENV NODE_ENV=production \
    FLEET_PORT=8787 \
    FLEET_DB=/var/lib/fleet-runner/state/fleet.sqlite \
    FLEET_OUT_DIR=/var/lib/fleet-runner/output \
    FLEET_PUBLIC_KEYS_DIR=/run/fleet-runner/public-keys
WORKDIR /app
RUN mkdir -p /var/lib/fleet-runner/state /var/lib/fleet-runner/output /run/fleet-runner/public-keys \
 && chown -R node:node /var/lib/fleet-runner /run/fleet-runner
COPY --chown=node:node --from=build /workspace/packages/fleet-runner/dist ./dist
COPY --chown=node:node packages/fleet-runner/docker-entrypoint.mjs ./docker-entrypoint.mjs
USER node
EXPOSE 8787
ENTRYPOINT ["node", "/app/docker-entrypoint.mjs"]
CMD ["serve"]
