# `@core/fleet-runner`

Fleet-runner provides the queue store, signed HTTP client, and worker loop. Its CLI
manages the service, credentials and status, and runs the
[bundled declared-command worker](https://github.com/ojfbot/core/blob/main/packages/fleet-runner/worker-release.md).
Applications provide installed commands rather than code loaded into that worker.
Library consumers can still provide their own job handlers.

See [deployment and worker setup](./deployment.md) for the container service,
the portable package artifact flow, and the clean-build proof command.

See [backup and restore](./recovery.md) for the isolated G7 recovery commands,
generation fencing, persisted restore hold, and qualification boundary.
