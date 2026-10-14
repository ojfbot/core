import { describe, expect, it } from "vitest";
import { parse, validate } from "graphql";
import { buildReadModelSchema } from "../index.js";

describe("existing-source inspector read contract", () => {
  it("permits human and agent readers to request source coordinates and a pinned evidence summary", () => {
    const query = parse(
      '{ workItems(lane:"pickup") { sourceRecordKey sourceRecord { kind source repository nativeId sourcePath } } evidenceSummary { snapshotId generatedAt total unresolvedCount coverage { status } } }',
    );
    expect(validate(buildReadModelSchema(), query).map((error) => error.message)).toEqual([]);
  });
});
