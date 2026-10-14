import { describe, expect, it } from "vitest";
import { isObjectType, isUnionType, parse, validate } from "graphql";
import { buildReadModelSchema } from "../index.js";
const schema = buildReadModelSchema();
describe("inspector contract variants", () => {
  it("closes source identity over current source variants only", () => {
    const source = schema.getType("SourceRecord");
    expect(isUnionType(source)).toBe(true);
    if (isUnionType(source))
      expect(
        source
          .getTypes()
          .map((type) => type.name)
          .sort(),
      ).toEqual(["DoltBeadSourceRecord", "HandoffDocumentSourceRecord"]);
    expect(schema.getType("GithubSourceRecord")).toBeUndefined();
  });
  it("diagnostics expose roles and cannot combine a responding_to cycle with a generic bag", () => {
    const union = schema.getType("UnresolvedRelationDiagnostic");
    if (!isUnionType(union)) throw new Error("Expected diagnostic union");
    expect(
      union
        .getTypes()
        .map((type) => type.name)
        .sort(),
    ).toEqual([
      "AmbiguousTargetDiagnostic",
      "MissingTargetDiagnostic",
      "RelationCycleDiagnostic",
      "SuccessorOrderDiagnostic",
    ]);
    const cycle = schema.getType("RelationCycleDiagnostic");
    if (!isObjectType(cycle)) throw new Error("Expected cycle object");
    expect(Object.keys(cycle.getFields()).sort()).toEqual(["cycleKeys", "reason", "relation"]);
    expect(
      validate(
        schema,
        parse(
          '{ evidenceIndex(snapshotId:"expired") { ... on EvidenceIndex { handoff { ... on ObservedHandoffIndex { unresolvedRelations { ... on RelationCycleDiagnostic { affectedSourceRecordKeys } } } } } } }',
        ),
      ),
    ).toHaveLength(1);
  });
  it("production states and snapshot read failure states are distinct schema variants", () => {
    for (const [name, expected] of [
      [
        "DocumentProduction",
        [
          "LegacyUnknownDocumentProduction",
          "RecordedDocumentProduction",
          "UnavailableDocumentProduction",
        ],
      ],
      [
        "EvidenceRecordResult",
        [
          "EvidenceInvalidReference",
          "EvidenceRecord",
          "EvidenceRecordNotObserved",
          "EvidenceRefreshRequired",
          "EvidenceSourceUnavailable",
        ],
      ],
    ] as const) {
      const type = schema.getType(name);
      if (!isUnionType(type)) throw new Error("Expected union");
      expect(
        type
          .getTypes()
          .map((member) => member.name)
          .sort(),
      ).toEqual(expected);
    }
  });
});
