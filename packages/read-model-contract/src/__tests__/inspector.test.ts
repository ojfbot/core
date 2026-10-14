import { describe, expect, it } from "vitest";
import { parse, validate } from "graphql";
import { buildReadModelSchema } from "../index.js";

describe("existing-source inspector read contract", () => {
  it("permits human and agent readers to request source coordinates and a pinned evidence summary", () => {
    const query = parse(
      '{ workItems(lane:"pickup") { sourceRecordKey inspectionTarget { __typename ... on AvailableInspectionTarget { snapshotId sourceRecordKey } } sourceRecord { __typename ... on DoltBeadSourceRecord { nativeId } ... on HandoffDocumentSourceRecord { sourcePath } } } evidenceSummary { snapshotId generatedAt expiresAt unresolvedCount dolt { total coverage { status } } handoff { inventory { total coverage { status } } populationCount } } }',
    );
    expect(validate(buildReadModelSchema(), query).map((error) => error.message)).toEqual([]);
  });
});
