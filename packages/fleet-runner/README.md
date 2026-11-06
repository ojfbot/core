# `@core/fleet-runner`

Fleet-runner provides the queue store, signed HTTP client, and worker loop. The
`fleet-runner` executable only manages the service (`serve`) and credential
generation (`keygen`); it does not execute application-specific worker jobs.
Workers install this library and provide their own job handlers.

See [deployment and worker setup](./deployment.md) for the container service,
the portable package artifact flow, and the clean-build proof command.
