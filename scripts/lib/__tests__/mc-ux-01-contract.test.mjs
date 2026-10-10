import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { evaluateFixture } from '../mc-ux-01-contract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, '../../mc-ux-01-contract-check.mjs');
const temporaryRoots = [];

afterEach(() => {
  while (temporaryRoots.length) rmSync(temporaryRoots.pop(), { recursive: true, force: true });
});

describe('MC-UX-01 candidate evidence contract', () => {
  it('does not settle the original obligation from an authored completion claim', () => {
    const result = evaluateFixture({
      fixture_id: 'completion-claim-without-settlement',
      synthetic: true,
      proves_deployed_producer: false,
      original_action_id: 'act-1',
      current_subject_revision: 'rev-2',
      records: [{
        id: 'claim-1',
        kind: 'agent_claim',
        schema_version: 'mc-ux-01/candidate-v1',
        subject: { id: 'work-1', revision: 'rev-2' },
        producer: { id: 'worker-1', kind: 'agent' },
        source_refs: [{ id: 'report-1', revision: 'r1' }],
        links: [{ rel: 'reports_on', target: 'act-1' }],
        annotations: { proposition: 'completed' },
      }],
    });

    expect(result.journey.settlement).toEqual({ state: 'unproven', evidence: [] });
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'ORIGINAL_ACTION_UNSETTLED',
      severity: 'error',
    }));
  });
  it('keeps stale, missing, and conflicting identity evidence unresolved', () => {
    const base = {
      kind: 'observation',
      schema_version: 'mc-ux-01/candidate-v1',
      subject: { id: 'work-1', revision: 'rev-2' },
      producer: { id: 'collector-1', kind: 'service' },
      source_refs: [],
      links: [],
    };
    const result = evaluateFixture({
      fixture_id: 'unresolved-source-identities',
      synthetic: true,
      proves_deployed_producer: false,
      original_action_id: 'act-1',
      current_subject_revision: 'rev-2',
      records: [
        { ...base, id: 'stale', annotations: { identity: { source: 'handoff', repository: 'alpha', native_id: '42', path: '.handoff/a.md', freshness: 'stale' } } },
        { ...base, id: 'missing', annotations: { identity: { repository: 'alpha', native_id: '43', freshness: 'current' } } },
        { ...base, id: 'conflict', annotations: { identity: { source: 'handoff', repository: 'alpha', native_id: '44', path: '.handoff/c.md', freshness: 'current', conflicts_with: ['handoff:beta:44:.handoff/c.md'] } } },
      ],
    });

    expect(result.identity).toEqual(expect.objectContaining({ state: 'unresolved' }));
    expect(result.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'IDENTITY_STALE',
      'IDENTITY_MISSING',
      'IDENTITY_CONFLICT',
    ]));
  });
  it('keeps distinct processes separate when they share a harness', () => {
    const base = {
      kind: 'execution_attempt',
      schema_version: 'mc-ux-01/candidate-v1',
      subject: { id: 'work-1', revision: 'rev-2' },
      producer: { id: 'runner-1', kind: 'service' },
      source_refs: [{ id: 'runner-ledger', revision: 'r7' }],
      links: [],
    };
    const result = evaluateFixture({
      fixture_id: 'same-harness-distinct-processes',
      synthetic: true,
      proves_deployed_producer: false,
      original_action_id: 'act-1',
      current_subject_revision: 'rev-2',
      records: [
        { ...base, id: 'attempt-1', annotations: { process: { harness: 'codex', process_id: 'proc-1', session_id: 'session-1', host_id: 'host-a' } } },
        { ...base, id: 'attempt-2', annotations: { process: { harness: 'codex', process_id: 'proc-2', session_id: 'session-2', host_id: 'host-a' } } },
      ],
    });

    expect(result.processes).toEqual([
      { harness: 'codex', process_id: 'proc-1', session_id: 'session-1', host_id: 'host-a' },
      { harness: 'codex', process_id: 'proc-2', session_id: 'session-2', host_id: 'host-a' },
    ]);
    expect(result.findings.map((finding) => finding.code)).not.toContain('PROCESS_COLLAPSE');
  });
  it('does not infer a human obligation from actor and recipient equality', () => {
    const result = evaluateFixture({
      fixture_id: 'actor-recipient-equality',
      synthetic: true,
      proves_deployed_producer: false,
      original_action_id: 'act-1',
      current_subject_revision: 'rev-2',
      records: [{
        id: 'disposition-1',
        kind: 'disposition',
        schema_version: 'mc-ux-01/candidate-v1',
        subject: { id: 'work-1', revision: 'rev-2' },
        producer: { id: 'ojfbot', kind: 'agent' },
        source_refs: [{ id: 'comment-1', revision: 'r1' }],
        links: [],
        annotations: {
          actor: { id: 'ojfbot', kind: 'unknown' },
          recipient: { id: 'ojfbot', role: 'operator' },
          obligation_evidence: [],
        },
      }],
    });

    expect(result.recipient).toEqual({ state: 'unresolved', evidence: [] });
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'ACTOR_RECIPIENT_EQUALITY_UNRESOLVED',
      severity: 'error',
    }));
  });
  it('quarantines unsupported schema versions and records missing recipient roles', () => {
    const result = evaluateFixture({
      fixture_id: 'schema-and-role-rejection',
      synthetic: true,
      proves_deployed_producer: false,
      original_action_id: 'act-1',
      current_subject_revision: 'rev-2',
      records: [
        {
          id: 'wrong-schema',
          kind: 'observation',
          schema_version: 'mc-ux-01/candidate-v2',
          subject: { id: 'work-1', revision: 'rev-2' },
          producer: { id: 'collector-1', kind: 'service' },
          source_refs: [],
          links: [],
          annotations: {},
        },
        {
          id: 'missing-role',
          kind: 'publication_intent',
          schema_version: 'mc-ux-01/candidate-v1',
          subject: { id: 'report-1', revision: 'report-r1' },
          producer: { id: 'publisher-1', kind: 'service' },
          source_refs: [],
          links: [],
          annotations: { recipient: { id: 'operator' } },
        },
      ],
    });

    expect(result.quarantined).toEqual(['wrong-schema', 'missing-role']);
    expect(result.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'UNSUPPORTED_SCHEMA_VERSION',
      'RECIPIENT_ROLE_MISSING',
    ]));
    expect(result.findings.map((finding) => finding.code)).not.toContain('IDENTITY_MISSING');
    expect(result.findings.map((finding) => finding.code)).not.toContain('REMOTE_RECEIPT_MISSING');
    expect(result.journey.publication).toEqual({ state: 'unproven', evidence: [] });
  });
  it('rejects approval for an older subject revision', () => {
    const result = evaluateFixture({
      fixture_id: 'approval-old-revision',
      synthetic: true,
      proves_deployed_producer: false,
      original_action_id: 'act-1',
      current_subject_revision: 'rev-2',
      records: [{
        id: 'approval-1',
        kind: 'approval',
        schema_version: 'mc-ux-01/candidate-v1',
        subject: { id: 'work-1', revision: 'rev-1' },
        producer: { id: 'operator', kind: 'human' },
        source_refs: [{ id: 'authority-boundary-1', revision: 'r1' }],
        links: [{ rel: 'authorized_by', target: 'authority-boundary-1' }],
        annotations: { authority_verified: true, permitted_act: 'execute' },
      }],
    });

    expect(result.journey.approval).toEqual({ state: 'stale', evidence: ['approval-1'] });
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'APPROVAL_REVISION_MISMATCH',
      severity: 'error',
    }));
  });
  it('rejects an agent attempt to create a human ruling through a shared account', () => {
    const result = evaluateFixture({
      fixture_id: 'agent-shared-account-ruling',
      synthetic: true,
      proves_deployed_producer: false,
      original_action_id: 'act-1',
      current_subject_revision: 'rev-2',
      records: [{
        id: 'approval-agent-1',
        kind: 'approval',
        schema_version: 'mc-ux-01/candidate-v1',
        subject: { id: 'work-1', revision: 'rev-2' },
        producer: { id: 'codex-worker', kind: 'agent' },
        source_refs: [{ id: 'github-comment-1', revision: 'r1' }],
        links: [],
        annotations: {
          transmitted_by_account: 'ojfbot',
          account_shared_with_agents: true,
          authority_verified: false,
          claimed_actor_kind: 'human',
        },
      }],
    });

    expect(result.journey.approval).toEqual({ state: 'unverified', evidence: ['approval-agent-1'] });
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'HUMAN_AUTHORITY_UNVERIFIED',
      severity: 'error',
    }));
  });
  it('does not treat a file write as remotely delivered', () => {
    const result = evaluateFixture({
      fixture_id: 'file-write-without-remote-receipt',
      synthetic: true,
      proves_deployed_producer: false,
      original_action_id: 'act-1',
      current_subject_revision: 'rev-2',
      records: [
        {
          id: 'prepared-1',
          kind: 'prepared_artifact',
          schema_version: 'mc-ux-01/candidate-v1',
          subject: { id: 'report-1', revision: 'report-r1' },
          producer: { id: 'writer-1', kind: 'agent' },
          source_refs: [{ id: 'file:.handoff/report.md', revision: 'sha256:abc' }],
          links: [{ rel: 'reports_on', target: 'act-1' }],
          annotations: { body_digest: 'sha256:abc', local_write: 'succeeded' },
        },
        {
          id: 'publish-1',
          kind: 'publication_intent',
          schema_version: 'mc-ux-01/candidate-v1',
          subject: { id: 'report-1', revision: 'report-r1' },
          producer: { id: 'publisher-1', kind: 'service' },
          source_refs: [{ id: 'prepared-1', revision: 'report-r1' }],
          links: [{ rel: 'derived_from', target: 'prepared-1' }],
          annotations: { recipient: { id: 'core-307', role: 'issue' }, outcome: 'not_attempted' },
        },
      ],
    });

    expect(result.journey.preparation).toEqual({ state: 'proven', evidence: ['prepared-1'] });
    expect(result.journey.publication).toEqual({ state: 'unproven', evidence: ['publish-1'] });
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'REMOTE_RECEIPT_MISSING',
      severity: 'error',
    }));
  });
  it('holds delayed or unknown publication without blind retry', () => {
    const result = evaluateFixture({
      fixture_id: 'unknown-publication-hold',
      synthetic: true,
      proves_deployed_producer: false,
      original_action_id: 'act-1',
      current_subject_revision: 'rev-2',
      records: [{
        id: 'publish-unknown-1',
        kind: 'publication_intent',
        schema_version: 'mc-ux-01/candidate-v1',
        subject: { id: 'report-1', revision: 'report-r1' },
        producer: { id: 'publisher-1', kind: 'service' },
        source_refs: [{ id: 'request-1', revision: 'r1' }],
        links: [],
        annotations: {
          recipient: { id: 'core-307', role: 'issue' },
          outcome: 'unknown',
          outstanding_request_ids: ['request-1'],
        },
      }],
    });

    expect(result.journey.publication).toEqual({ state: 'unknown', evidence: ['publish-unknown-1'] });
    expect(result.publication_hold).toEqual({ active: true, scope: 'affected-item', retry_allowed: false });
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'PUBLICATION_OUTCOME_UNKNOWN',
      severity: 'error',
    }));
  });
  it('requires explicit evidence for preparation, claim, execution, delivery, consumption, and settlement', () => {
    const record = (id, kind, subject, producer, annotations, links = []) => ({
      id,
      kind,
      schema_version: 'mc-ux-01/candidate-v1',
      subject,
      producer,
      source_refs: [{ id: `${id}-source`, revision: 'r1' }],
      links,
      annotations,
    });
    const result = evaluateFixture({
      fixture_id: 'fully-evidenced-journey',
      synthetic: true,
      proves_deployed_producer: false,
      original_action_id: 'act-1',
      current_subject_revision: 'rev-2',
      records: [
        record('prepared-1', 'prepared_artifact', { id: 'report-1', revision: 'report-r1' }, { id: 'writer-1', kind: 'agent' }, { body_digest: 'sha256:abc' }),
        record('approval-1', 'approval', { id: 'work-1', revision: 'rev-2' }, { id: 'operator', kind: 'human' }, { authority_verified: true, permitted_act: 'execute' }, [{ rel: 'authorized_by', target: 'authority-boundary-1' }]),
        record('claim-1', 'claim_lease', { id: 'work-1', revision: 'rev-2' }, { id: 'runner-1', kind: 'service' }, { lease_id: 'lease-1', state: 'active' }),
        record('attempt-1', 'execution_attempt', { id: 'work-1', revision: 'rev-2' }, { id: 'runner-1', kind: 'service' }, { state: 'completed', process: { harness: 'codex', process_id: 'proc-1', session_id: 'session-1', host_id: 'host-a' } }),
        record('publish-1', 'publication_intent', { id: 'report-1', revision: 'report-r1' }, { id: 'publisher-1', kind: 'service' }, { recipient: { id: 'core-307', role: 'issue' }, outcome: 'succeeded', body_digest: 'sha256:abc' }),
        record('delivery-1', 'delivery_receipt', { id: 'report-1', revision: 'report-r1' }, { id: 'publisher-1', kind: 'service' }, { publication_intent_id: 'publish-1', remote_readback: true, body_digest: 'sha256:abc', remote_object_id: 'comment-1' }, [{ rel: 'published_as', target: 'comment-1' }]),
        record('consumption-1', 'consumption_receipt', { id: 'report-1', revision: 'report-r1' }, { id: 'consumer-1', kind: 'human' }, { delivery_receipt_id: 'delivery-1', consumed_revision: 'report-r1', action: 'acknowledged' }),
        record('settlement-1', 'settlement_receipt', { id: 'act-1', revision: 'action-r1' }, { id: 'operator', kind: 'human' }, { original_action_id: 'act-1', disposition: 'implemented', verified: true }, [{ rel: 'reports_on', target: 'act-1' }]),
      ],
    });

    expect(result.journey).toEqual({
      preparation: { state: 'proven', evidence: ['prepared-1'] },
      approval: { state: 'proven', evidence: ['approval-1'] },
      claim: { state: 'proven', evidence: ['claim-1'] },
      execution: { state: 'proven', evidence: ['attempt-1'] },
      publication: { state: 'proven', evidence: ['delivery-1'] },
      consumption: { state: 'proven', evidence: ['consumption-1'] },
      settlement: { state: 'proven', evidence: ['settlement-1'] },
    });
    expect(result.findings).toEqual([]);
  });

  it('executes a manifest through the public CLI and emits a pinned conformance report', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'mc-ux-contract-'));
    temporaryRoots.push(root);
    const manifestPath = path.join(root, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify({
      profile_id: 'mc-ux-01/domain-contract',
      profile_version: 'candidate-v1',
      synthetic: true,
      proves_deployed_producer: false,
      cases: [{
        criterion_id: 'MCUX-C01',
        description: 'authored completion is not settlement',
        fixture: {
          fixture_id: 'completion-claim-without-settlement',
          synthetic: true,
          proves_deployed_producer: false,
          original_action_id: 'act-1',
          current_subject_revision: 'rev-2',
          records: [{
            id: 'claim-1',
            kind: 'agent_claim',
            schema_version: 'mc-ux-01/candidate-v1',
            subject: { id: 'work-1', revision: 'rev-2' },
            producer: { id: 'worker-1', kind: 'agent' },
            source_refs: [],
            links: [],
            annotations: { proposition: 'completed' },
          }],
        },
        expect: {
          finding_codes: ['ORIGINAL_ACTION_UNSETTLED'],
          stages: { settlement: 'unproven' },
        },
      }],
    }, null, 2));

    const run = spawnSync(process.execPath, [CLI, '--manifest', manifestPath, '--json'], { encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    const report = JSON.parse(run.stdout);
    expect(report).toEqual(expect.objectContaining({
      artifact_kind: 'mc-ux-01-conformance-report',
      profile_id: 'mc-ux-01/domain-contract',
      profile_version: 'candidate-v1',
      manifest_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      synthetic: true,
      proves_deployed_producer: false,
      summary: { total: 1, passed: 1, failed: 0, untested: 0 },
    }));
    expect(report.results).toEqual([expect.objectContaining({
      criterion_id: 'MCUX-C01',
      verdict: 'PASS',
    })]);
  });

  it('fails a manifest case when the evaluator emits an unexpected finding', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'mc-ux-contract-'));
    temporaryRoots.push(root);
    const manifestPath = path.join(root, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify({
      profile_id: 'mc-ux-01/domain-contract',
      profile_version: 'candidate-v1',
      synthetic: true,
      proves_deployed_producer: false,
      cases: [{
        criterion_id: 'MCUX-C01',
        description: 'unexpected finding control',
        fixture: {
          fixture_id: 'completion-claim-without-settlement',
          synthetic: true,
          proves_deployed_producer: false,
          original_action_id: 'act-1',
          current_subject_revision: 'rev-2',
          records: [{
            id: 'claim-1', kind: 'agent_claim', schema_version: 'mc-ux-01/candidate-v1',
            subject: { id: 'work-1', revision: 'rev-2' },
            producer: { id: 'worker-1', kind: 'agent' },
            source_refs: [], links: [], annotations: { proposition: 'completed' },
          }],
        },
        expect: { finding_codes: [], stages: { settlement: 'unproven' } },
      }],
    }));

    const run = spawnSync(process.execPath, [CLI, '--manifest', manifestPath, '--json'], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    const report = JSON.parse(run.stdout);
    expect(report.summary).toEqual({ total: 1, passed: 0, failed: 1, untested: 0 });
    expect(report.results[0].unexpected_finding_codes).toEqual(['ORIGINAL_ACTION_UNSETTLED']);
  });
});
