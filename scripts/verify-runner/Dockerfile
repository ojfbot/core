# A stand-in for the GitHub `ubuntu-latest` / `ubuntu-24.04` runner, used by `pnpm verify` on a Mac.
# Core's workflows run bash, Python, git, Node and pnpm, and one job builds Docker images, so each job
# runs in this container on a clean clone of HEAD, as on GitHub's fresh runner. It talks to the same
# Docker engine as the host (the socket is mounted only into a job that builds images).
#
# The versions come from the repository as build arguments: NODE_VERSION from the job's setup-node
# step, PNPM_VERSION from package.json "packageManager". The Docker CLI, Buildx and Compose are
# copied from the pinned official CLI image.
ARG NODE_VERSION
FROM node:${NODE_VERSION}-bookworm-slim AS node
FROM docker:27.5.1-cli AS docker-cli
FROM ubuntu:24.04
ARG PNPM_VERSION
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bash build-essential ca-certificates coreutils curl git jq openssl python3 python3-pip python3-venv rsync sudo tar unzip util-linux xz-utils zip \
 && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && npm install -g "pnpm@${PNPM_VERSION}" \
 && npm cache clean --force
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins
# Ubuntu 24.04 ships Python 3.12, the python3 on GitHub's ubuntu-24.04 image.
# The runner user, with passwordless sudo like the GitHub runner's.
RUN userdel -r ubuntu 2>/dev/null; useradd --create-home --uid 1001 --shell /bin/bash runner \
 && echo 'runner ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/runner \
 && chmod 0440 /etc/sudoers.d/runner
USER runner
WORKDIR /home/runner
CMD ["sleep", "infinity"]
