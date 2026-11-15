import { object } from "./admission.js";
import type { DispatchRequest } from "./types.js";

export interface RelayedCanaryProposal {
  attribution: "device-relayed-output";
  source: "deterministic-emulator" | "supervised-native";
  verifiedWork: false;
  ack: { messageId: string; bindingRevision: string; fixtureDigest: string };
  result: { text: string };
}

export const ADVISORY_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ack", "result"],
  properties: {
    ack: {
      type: "object",
      additionalProperties: false,
      required: ["messageId", "bindingRevision", "fixtureDigest"],
      properties: {
        messageId: { type: "string" },
        bindingRevision: { type: "string" },
        fixtureDigest: { type: "string" },
      },
    },
    result: {
      type: "object",
      additionalProperties: false,
      required: ["text"],
      properties: { text: { type: "string", minLength: 1, maxLength: 2048 } },
    },
  },
};

/** Native completion does not call this acceptance check implicitly. */
export function parseCanaryProposal(
  value: unknown,
  request: DispatchRequest,
  fixtureDigest: string,
): RelayedCanaryProposal {
  if (
    !object(value) ||
    Object.keys(value).sort().join(",") !== "ack,result" ||
    !object(value.ack) ||
    Object.keys(value.ack).sort().join(",") !== "bindingRevision,fixtureDigest,messageId" ||
    value.ack.messageId !== request.messageId ||
    value.ack.bindingRevision !== request.bindingRevision ||
    value.ack.fixtureDigest !== fixtureDigest ||
    !object(value.result) ||
    Object.keys(value.result).join(",") !== "text" ||
    typeof value.result.text !== "string" ||
    value.result.text.length < 1 ||
    value.result.text.length > 2048 ||
    Buffer.byteLength(value.result.text) > 4096
  )
    throw Error("invalid-agent-proposal");
  return {
    attribution: "device-relayed-output",
    source: "deterministic-emulator",
    verifiedWork: false,
    ack: { messageId: request.messageId, bindingRevision: request.bindingRevision, fixtureDigest },
    result: { text: value.result.text },
  };
}
