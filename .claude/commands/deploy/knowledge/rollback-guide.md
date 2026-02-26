# Rollback Guide

A rollback is not a failure — it's a controlled response to unexpected production behavior. The goal is to restore the known-good state faster than fixing forward.

## Rollback triggers

Initiate rollback if ANY of the following occur within 30 minutes of deployment:

- Error rate increases >2x baseline
- P95 latency increases >3x baseline
- Critical user-facing function is broken (auth, data access, core flow)
- Data corruption detected
- Security incident discovered

## Rollback procedure (general)

### 1. Communicate
```
In team channel: "Initiating rollback of [deploy description]. ETA [X] min."
```

### 2. Revert the deployment

**Heroku:**
```bash
heroku rollback v[N] --app [app-name]
```

**Railway:**
```bash
railway rollback [deployment-id]
```

**GitHub Actions / manual deployment:**
```bash
git revert HEAD --no-edit
git push origin main
# Or: re-deploy previous commit directly
git checkout <previous-commit-sha>
git push --force-with-lease origin main  # use with care
```

**Docker / container deployment:**
```bash
docker pull [image]:[previous-tag]
docker service update --image [image]:[previous-tag] [service-name]
```

### 3. Verify rollback

- [ ] Error rate returns to baseline
- [ ] P95 latency returns to baseline
- [ ] Smoke test the affected flow manually
- [ ] Confirm no data was corrupted

### 4. Communicate resolution
```
"Rollback complete. [Service] restored to previous version. Error rate nominal. Root cause under investigation."
```

## Database migration rollback

If a database migration was included in the deployment:

1. Check if a down migration exists — `<timestamp>_down.sql` or `--undo` command
2. Run the down migration BEFORE reverting the code
3. If no down migration exists: assess whether the schema change is backward-compatible with the old code
   - Added nullable column: old code still works (no rollback needed for schema)
   - Renamed/dropped column: old code will fail — requires manual intervention

**Never run a down migration on production data without a backup.**

## When NOT to roll back

- The bug is in a non-critical path and a fix is ready to deploy in <30 minutes
- Rolling back would reverse a data migration and data loss would result
- The issue is in infrastructure (DNS, CDN) that code rollback won't fix

## Post-rollback

- File an incident report (even brief: what happened, what was rolled back, root cause)
- Add a test for the failure case before re-deploying
- Re-deploy only after root cause is confirmed
