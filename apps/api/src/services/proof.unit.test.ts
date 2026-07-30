import { describe, expect, test } from "bun:test";
import { ErrorCode } from "@xs-share/shared";
import { AppError } from "../lib/errors";
import {
  normalizeProofPayload,
  proofFingerprint,
  validateProofAgainstSchema,
} from "./proof";

describe("proof helpers", () => {
  test("normalize maps legacy url key", () => {
    const payload = normalizeProofPayload({
      url: " https://x.com/a ",
      note: " hi ",
    });
    expect(payload.proofUrl).toBe("https://x.com/a");
    expect(payload.note).toBe("hi");
  });

  test("validate requires screenshot when schema says so", () => {
    expect(() =>
      validateProofAgainstSchema(
        {
          proofUrl: { required: true },
          screenshot: { required: true },
        },
        { proofUrl: "https://x.com/a" },
      ),
    ).toThrow(AppError);

    try {
      validateProofAgainstSchema(
        {
          proofUrl: { required: true },
          screenshot: { required: true },
        },
        { proofUrl: "https://x.com/a" },
      );
    } catch (error) {
      expect((error as AppError).code).toBe(ErrorCode.PROOF_INVALID);
    }
  });

  test("fingerprint is stable", () => {
    const left = proofFingerprint({
      proofUrl: "HTTPS://X.COM/A",
      screenshot: "https://cdn.example/a.png",
    });
    const right = proofFingerprint({
      proofUrl: "https://x.com/a",
      screenshot: "https://cdn.example/a.png",
    });
    expect(left).toBe(right);
  });
});
