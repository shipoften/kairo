import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  isAllowedUploadContentType,
  UPLOAD_MAX_BYTES,
  type UploadContentType,
} from "@xs-share/shared";
import type { AppConfig } from "../../config";
import { AppError } from "../../lib/errors";
import { ErrorCode } from "@xs-share/shared";

export type PresignResult = {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  headers: Record<string, string>;
  contentType: UploadContentType;
  expiresInSeconds: number;
};

function extensionForContentType(contentType: UploadContentType): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}

export function createS3Client(
  config: AppConfig,
  options?: { forPresign?: boolean },
) {
  if (
    !config.S3_ENDPOINT ||
    !config.S3_BUCKET ||
    !config.S3_ACCESS_KEY_ID ||
    !config.S3_SECRET_ACCESS_KEY
  ) {
    throw new AppError(
      ErrorCode.UPLOAD_INVALID,
      "Upload storage is not configured",
      503,
      "errors.upload_invalid",
    );
  }

  const endpoint = options?.forPresign
    ? (config.S3_PRESIGN_ENDPOINT ?? config.S3_ENDPOINT)
    : config.S3_ENDPOINT;

  return new S3Client({
    region: config.S3_REGION,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
  });
}

export function publicUrlForObject(config: AppConfig, objectKey: string) {
  const base = (config.S3_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  if (base) return `${base}/${objectKey}`;
  const endpoint = (config.S3_ENDPOINT ?? "").replace(/\/$/, "");
  return `${endpoint}/${config.S3_BUCKET}/${objectKey}`;
}

export async function createPresignedUpload(input: {
  config: AppConfig;
  userId: string;
  contentType: string;
  sizeBytes: number;
}): Promise<PresignResult> {
  if (!isAllowedUploadContentType(input.contentType)) {
    throw new AppError(
      ErrorCode.UPLOAD_INVALID,
      "Unsupported image type",
      400,
      "errors.upload_invalid",
    );
  }
  if (
    !Number.isInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > UPLOAD_MAX_BYTES
  ) {
    throw new AppError(
      ErrorCode.UPLOAD_INVALID,
      `File must be between 1 byte and ${UPLOAD_MAX_BYTES} bytes`,
      400,
      "errors.upload_invalid",
    );
  }

  const contentType = input.contentType;
  const extension = extensionForContentType(contentType);
  const objectKey = `proofs/${input.userId}/${crypto.randomUUID()}.${extension}`;
  const client = createS3Client(input.config, { forPresign: true });
  const expiresInSeconds = 600;
  const command = new PutObjectCommand({
    Bucket: input.config.S3_BUCKET,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: input.sizeBytes,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });

  return {
    uploadUrl,
    objectKey,
    publicUrl: publicUrlForObject(input.config, objectKey),
    headers: {
      "Content-Type": contentType,
    },
    contentType,
    expiresInSeconds,
  };
}

export async function assertObjectExists(input: {
  config: AppConfig;
  objectKey: string;
  expectedUserId: string;
}) {
  if (!input.objectKey.startsWith(`proofs/${input.expectedUserId}/`)) {
    throw new AppError(
      ErrorCode.UPLOAD_INVALID,
      "Invalid object key",
      400,
      "errors.upload_invalid",
    );
  }

  const client = createS3Client(input.config);
  try {
    const result = await client.send(
      new HeadObjectCommand({
        Bucket: input.config.S3_BUCKET,
        Key: input.objectKey,
      }),
    );
    const contentType = result.ContentType ?? "";
    const sizeBytes = result.ContentLength ?? 0;
    if (!isAllowedUploadContentType(contentType)) {
      throw new AppError(
        ErrorCode.UPLOAD_INVALID,
        "Uploaded object has invalid content type",
        400,
        "errors.upload_invalid",
      );
    }
    if (sizeBytes <= 0 || sizeBytes > UPLOAD_MAX_BYTES) {
      throw new AppError(
        ErrorCode.UPLOAD_INVALID,
        "Uploaded object size is invalid",
        400,
        "errors.upload_invalid",
      );
    }
    return {
      contentType,
      sizeBytes,
      publicUrl: publicUrlForObject(input.config, input.objectKey),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      ErrorCode.UPLOAD_INVALID,
      "Uploaded object not found",
      400,
      "errors.upload_invalid",
    );
  }
}
