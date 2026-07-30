import { createHash } from "node:crypto";
import {
  ErrorCode,
  ProofField,
  type ProofSchema,
} from "@xs-share/shared";
import { AppError } from "../lib/errors";

const URL_PATTERN = /^https?:\/\/.+/i;

export function normalizeProofPayload(
  payload: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!payload || typeof payload !== "object") return {};
  const result: Record<string, string> = {};
  for (const key of Object.values(ProofField)) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      result[key] = value.trim();
    }
  }
  // Legacy schema key "url" mapped to proofUrl
  if (!result.proofUrl && typeof payload.url === "string" && payload.url.trim()) {
    result.proofUrl = payload.url.trim();
  }
  return result;
}

export function validateProofAgainstSchema(
  schema: ProofSchema | Record<string, unknown>,
  payload: Record<string, string>,
) {
  const fields = Object.values(ProofField);
  for (const field of fields) {
    const requirement = (schema as ProofSchema)[field];
    if (!requirement) continue;
    const value = payload[field] ?? "";
    if (requirement.required && !value) {
      throw new AppError(
        ErrorCode.PROOF_INVALID,
        `Missing required proof field: ${field}`,
        400,
        "errors.proof_invalid",
      );
    }
    if (
      value &&
      (field === ProofField.proofUrl || field === ProofField.screenshot) &&
      !URL_PATTERN.test(value)
    ) {
      throw new AppError(
        ErrorCode.PROOF_INVALID,
        `Invalid URL for proof field: ${field}`,
        400,
        "errors.proof_invalid",
      );
    }
  }
}

export function proofFingerprint(payload: Record<string, string>): string {
  const proofUrl = (payload.proofUrl ?? "").trim().toLowerCase();
  const screenshot = (payload.screenshot ?? "").trim().toLowerCase();
  const raw = `${proofUrl}|${screenshot}`;
  return createHash("sha256").update(raw).digest("hex");
}
