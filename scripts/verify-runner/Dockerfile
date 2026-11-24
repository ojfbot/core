# A stand-in for the GitHub Ubuntu runner a job's `runs-on` names, used by `pnpm verify` on a Mac.
# It is built from the Ubuntu release of that label (`ubuntu-latest` is 26.04 at the time of
# writing, see LINUX_RUNNERS in scripts/lib/verify-ci.mjs) and holds the tools core's jobs use:
# bash, git, Python 3, jq, sqlite3, build tools, Node, pnpm and the Docker CLI with Buildx. It is NOT
# GitHub's full runner image (which has far more preinstalled), so a job that relies on a tool that
# is only there fails here for a reason GitHub would not give; add the tool when that happens.
# Each job runs in it on a clean clone of HEAD. The Docker socket is mounted only into the opt-in
# release job.
#
# The versions come from the repository as build arguments: UBUNTU_VERSION from the job's runs-on,
# NODE_VERSION from its setup-node step, PNPM_VERSION from package.json "packageManager". The Docker
# CLI, Buildx and Compose are copied from the pinned official CLI image.
ARG NODE_VERSION
ARG UBUNTU_VERSION
FROM node:${NODE_VERSION}-bookworm-slim AS node
FROM docker:27.5.1-cli AS docker-cli
FROM ubuntu:${UBUNTU_VERSION}
ARG PNPM_VERSION
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bash build-essential ca-certificates coreutils curl git jq openssl python3 python3-pip python3-venv python3-yaml rsync sqlite3 sudo tar unzip util-linux xz-utils zip \
 && rm -rf /var/lib/apt/lists/*
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && npm install -g "pnpm@${PNPM_VERSION}" \
 && npm cache clean --force
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins
# sqlite3 is on GitHub's ubuntu image; the Codex-automation tests call its command line.
# python3-yaml (PyYAML) is installed explicitly: the bead skill's test imports it.
# python3 is the release's own (3.12 on 24.04), as on GitHub's image of the same release.
# The runner user, with passwordless sudo like the GitHub runner's.
RUN userdel -r ubuntu 2>/dev/null; useradd --create-home --uid 1001 --shell /bin/bash runner \
 && echo 'runner ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/runner \
 && chmod 0440 /etc/sudoers.d/runner
USER runner
WORKDIR /home/runner
CMD ["sleep", "infinity"]
