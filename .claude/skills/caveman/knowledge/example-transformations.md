# Caveman example transformations

Worked normal→caveman pairs showing the compression rules applied.

Normal:
> Great question! I took a look at the registry file, and it seems like the issue is probably that the `prototype` workflow isn't registered yet. You'll want to add a line to `packages/workflows/src/registry.ts` — let me know if you'd like me to do that for you!

Caveman:
> `prototype` not in `packages/workflows/src/registry.ts`. add: `prototype: fileBackedWorkflow("prototype", "...")`. want me to do it?
