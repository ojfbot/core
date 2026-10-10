/**
 * Candidate MC-UX-01 evidence-contract shapes.
 *
 * This module is deliberately profile-scoped. Promotion to a shared contract
 * requires qualification evidence; this file is not a production fleet-runner
 * schema or canonical state owner.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** @typedef {'observation'|'agent_claim'|'assessment'|'disposition'|'prepared_artifact'|'approval'|'claim_lease'|'execution_attempt'|'publication_intent'|'delivery_receipt'|'consumption_receipt'|'settlement_receipt'} RecordKind */

/**
 * @typedef {object} ContractRecord
 * @property {string} id
 * @property {RecordKind} kind
 * @property {string} schema_version
 * @property {object} subject
 * @property {string} subject.id
 * @property {string} subject.revision
 * @property {object} producer
 * @property {string} producer.id
 * @property {'human'|'agent'|'service'|'unknown'} producer.kind
 * @property {Array<object>} source_refs
 * @property {Array<object>} links
 * @property {object} annotations
 */

/**
 * @typedef {object} ContractFixture
 * @property {string} fixture_id
 * @property {true} synthetic
 * @property {false} proves_deployed_producer
 * @property {string} current_subject_revision
 * @property {Array<ContractRecord>} records
 */

/**
 * Evaluate one synthetic conformance fixture.
 *
 * @param {ContractFixture} _fixture
 * @returns {object}
 */
export function evaluateFixture(_fixture) {
  const findings = [];
  const quarantined = [];

  for (const record of _fixture.records) {
    if (record.schema_version !== 'mc-ux-01/candidate-v1') {
      quarantined.push(record.id);
      findings.push({
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        severity: 'error',
        record_id: record.id,
      });
      continue;
    }
    if (record.kind === 'publication_intent' && !record.annotations?.recipient?.role) {
      quarantined.push(record.id);
      findings.push({
        code: 'RECIPIENT_ROLE_MISSING',
        severity: 'error',
        record_id: record.id,
      });
    }
  }
  const quarantinedIds = new Set(quarantined);
  const validRecords = _fixture.records.filter((record) => !quarantinedIds.has(record.id));
  const processes = validRecords
    .map((record) => record.annotations?.process)
    .filter((process) => process?.process_id && process?.session_id && process?.host_id)
    .map(({ harness, process_id, session_id, host_id }) => ({ harness, process_id, session_id, host_id }));
  const identityEvidence = validRecords
    .filter((record) => record.kind === 'observation')
    .map((record) => ({ record, identity: record.annotations?.identity }));

  for (const { record, identity } of identityEvidence) {
    if (!identity || !identity.source || !identity.repository || !identity.native_id || !identity.path) {
      findings.push({ code: 'IDENTITY_MISSING', severity: 'error', record_id: record.id });
    }
    if (identity?.freshness === 'stale') {
      findings.push({ code: 'IDENTITY_STALE', severity: 'error', record_id: record.id });
    }
    if (Array.isArray(identity?.conflicts_with) && identity.conflicts_with.length > 0) {
      findings.push({ code: 'IDENTITY_CONFLICT', severity: 'error', record_id: record.id });
    }
  }

  const unresolvedRecipient = validRecords.find((record) => {
    const actor = record.annotations?.actor;
    const recipient = record.annotations?.recipient;
    const evidence = record.annotations?.obligation_evidence;
    return actor?.id && actor.id === recipient?.id && (!Array.isArray(evidence) || evidence.length === 0);
  });
  if (unresolvedRecipient) {
    findings.push({
      code: 'ACTOR_RECIPIENT_EQUALITY_UNRESOLVED',
      severity: 'error',
      record_id: unresolvedRecipient.id,
    });
  }

  const approval = validRecords.find((record) => record.kind === 'approval');
  let approvalState = { state: 'unproven', evidence: [] };
  if (approval && approval.subject?.revision !== _fixture.current_subject_revision) {
    approvalState = { state: 'stale', evidence: [approval.id] };
    findings.push({
      code: 'APPROVAL_REVISION_MISMATCH',
      severity: 'error',
      record_id: approval.id,
    });
  } else if (approval && (approval.producer?.kind !== 'human' || approval.annotations?.authority_verified !== true)) {
    approvalState = { state: 'unverified', evidence: [approval.id] };
    findings.push({
      code: 'HUMAN_AUTHORITY_UNVERIFIED',
      severity: 'error',
      record_id: approval.id,
    });
  } else if (approval) {
    approvalState = { state: 'proven', evidence: [approval.id] };
  }

  const prepared = validRecords.find((record) => record.kind === 'prepared_artifact');
  const claim = validRecords.find((record) => record.kind === 'claim_lease');
  const execution = validRecords.find((record) => record.kind === 'execution_attempt');
  const publicationIntent = validRecords.find((record) => record.kind === 'publication_intent');
  const deliveryReceipt = validRecords.find((record) => record.kind === 'delivery_receipt');
  const consumptionReceipt = validRecords.find((record) => record.kind === 'consumption_receipt');
  const settlementReceipt = validRecords.find((record) => record.kind === 'settlement_receipt');
  const preparationState = prepared
    ? { state: 'proven', evidence: [prepared.id] }
    : { state: 'unproven', evidence: [] };
  const claimState = claim?.annotations?.state === 'active'
    ? { state: 'proven', evidence: [claim.id] }
    : { state: 'unproven', evidence: [] };
  const executionState = execution?.annotations?.state === 'completed'
    ? { state: 'proven', evidence: [execution.id] }
    : { state: 'unproven', evidence: [] };
  let publicationState = { state: 'unproven', evidence: publicationIntent ? [publicationIntent.id] : [] };
  let publicationHold = { active: false, scope: 'none', retry_allowed: false };
  if (publicationIntent?.annotations?.outcome === 'unknown') {
    publicationState = { state: 'unknown', evidence: [publicationIntent.id] };
    publicationHold = { active: true, scope: 'affected-item', retry_allowed: false };
    findings.push({
      code: 'PUBLICATION_OUTCOME_UNKNOWN',
      severity: 'error',
      record_id: publicationIntent.id,
    });
  }
  if (publicationIntent && !deliveryReceipt) {
    findings.push({
      code: 'REMOTE_RECEIPT_MISSING',
      severity: 'error',
      record_id: publicationIntent.id,
    });
  }
  if (deliveryReceipt?.annotations?.remote_readback === true
    && deliveryReceipt.annotations.publication_intent_id === publicationIntent?.id
    && deliveryReceipt.annotations.body_digest === publicationIntent?.annotations?.body_digest) {
    publicationState = { state: 'proven', evidence: [deliveryReceipt.id] };
  }
  const consumptionState = consumptionReceipt && deliveryReceipt
    && consumptionReceipt.annotations?.delivery_receipt_id === deliveryReceipt.id
    && consumptionReceipt.annotations?.consumed_revision === deliveryReceipt.subject?.revision
    ? { state: 'proven', evidence: [consumptionReceipt.id] }
    : { state: 'unproven', evidence: [] };
  const settlementState = settlementReceipt?.annotations?.original_action_id === _fixture.original_action_id
    && settlementReceipt.annotations?.verified === true
    ? { state: 'proven', evidence: [settlementReceipt.id] }
    : { state: 'unproven', evidence: [] };
  if (settlementState.state !== 'proven') {
    findings.push({
      code: 'ORIGINAL_ACTION_UNSETTLED',
      severity: 'error',
      message: 'No explicit settlement receipt ties the disposition to the original action.',
    });
  }

  return {
    quarantined,
    processes,
    publication_hold: publicationHold,
    recipient: unresolvedRecipient
      ? { state: 'unresolved', evidence: [] }
      : { state: 'unknown', evidence: [] },
    identity: {
      state: findings.some((finding) => finding.code.startsWith('IDENTITY_'))
        ? 'unresolved'
        : identityEvidence.length > 0 ? 'observed' : 'unknown',
      evidence: identityEvidence.map(({ record }) => record.id),
    },
    journey: {
      preparation: preparationState,
      approval: approvalState,
      claim: claimState,
      execution: executionState,
      publication: publicationState,
      consumption: consumptionState,
      settlement: settlementState,
    },
    findings,
  };
}

function evaluateCase(testCase) {
  const evaluation = evaluateFixture(testCase.fixture);
  const actualCodes = evaluation.findings.map((finding) => finding.code);
  const expectedCodes = testCase.expect?.finding_codes || [];
  const expectedStages = testCase.expect?.stages || {};
  const missingCodes = expectedCodes.filter((code) => !actualCodes.includes(code));
  const unexpectedCodes = actualCodes.filter((code) => !expectedCodes.includes(code));
  const stageMismatches = Object.entries(expectedStages)
    .filter(([stage, state]) => evaluation.journey?.[stage]?.state !== state)
    .map(([stage, expected]) => ({
      stage,
      expected,
      actual: evaluation.journey?.[stage]?.state ?? 'absent',
    }));
  return {
    criterion_id: testCase.criterion_id,
    fixture_id: testCase.fixture.fixture_id,
    description: testCase.description,
    verdict: missingCodes.length === 0 && unexpectedCodes.length === 0 && stageMismatches.length === 0 ? 'PASS' : 'FAIL',
    expected_finding_codes: expectedCodes,
    actual_finding_codes: actualCodes,
    missing_finding_codes: missingCodes,
    unexpected_finding_codes: unexpectedCodes,
    stage_mismatches: stageMismatches,
    journey: evaluation.journey,
  };
}

/**
 * CLI entry point.
 *
 * @param {string[]} _argv
 * @returns {number}
 */
export function main(argv) {
  const manifestFlag = argv.indexOf('--manifest');
  const manifestPath = manifestFlag >= 0 ? argv[manifestFlag + 1] : null;
  if (!manifestPath) throw new Error('Usage: mc-ux-01-contract-check --manifest <path> --json');
  const raw = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  const results = (manifest.cases || []).map(evaluateCase);
  const passed = results.filter((result) => result.verdict === 'PASS').length;
  const failed = results.filter((result) => result.verdict === 'FAIL').length;
  const report = {
    artifact_kind: 'mc-ux-01-conformance-report',
    profile_id: manifest.profile_id,
    profile_version: manifest.profile_version,
    manifest_sha256: createHash('sha256').update(raw).digest('hex'),
    synthetic: manifest.synthetic === true,
    proves_deployed_producer: manifest.proves_deployed_producer === true,
    summary: { total: results.length, passed, failed, untested: 0 },
    results,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return failed > 0 ? 1 : 0;
}
