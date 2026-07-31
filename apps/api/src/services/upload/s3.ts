import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ErrorCode,
  isAllowedUploadContentType,
  UPLOAD_MAX_BYTES,
  type UploadContentType,
} from "@xs-share/shared";
import type { AppConfig } from "../../config";
import { AppError } from "../../lib/errors";

export type PresignResult = {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  headers: Record<string, string>;
  contentType: UploadContentType;
  expiresInSeconds: number;
};

export type ObjectMetadata = {
  contentType: UploadContentType;
  sizeBytes: number;
};

function extensionForContentType(contentType: UploadContentType): string {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  return "webp";
}

function contentTypeFromObjectKey(objectKey: string): UploadContentType | null {
  const lower = objectKey.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
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

function validateObjectMetadata(contentType: string, sizeBytes: number) {
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
}

export async function readObjectMetadata(input: {
  config: AppConfig;
  objectKey: string;
}): Promise<ObjectMetadata> {
  const client = createS3Client(input.config);
  const bucket = input.config.S3_BUCKET!;

  try {
    const result = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
      }),
    );
    const contentType =
      result.ContentType ?? contentTypeFromObjectKey(input.objectKey) ?? "";
    const sizeBytes = result.ContentLength ?? 0;
    validateObjectMetadata(contentType, sizeBytes);
    return {
      contentType: contentType as UploadContentType,
      sizeBytes,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
  }

  const listResult = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: input.objectKey,
      MaxKeys: 1,
    }),
  );
  const item = listResult.Contents?.find(
    (entry) => entry.Key === input.objectKey,
  );
  if (!item?.Size) {
    throw new AppError(
      ErrorCode.UPLOAD_INVALID,
      "Uploaded object not found",
      400,
      "errors.upload_invalid",
    );
  }

  const contentType = contentTypeFromObjectKey(input.objectKey);
  if (!contentType) {
    throw new AppError(
      ErrorCode.UPLOAD_INVALID,
      "Uploaded object has invalid content type",
      400,
      "errors.upload_invalid",
    );
  }
  validateObjectMetadata(contentType, item.Size);
  return {
    contentType,
    sizeBytes: item.Size,
  };
}

export async function readObjectBytes(input: {
  config: AppConfig;
  objectKey: string;
}): Promise<{ body: Uint8Array; contentType: string }> {
  const client = createS3Client(input.config);
  const result = await client.send(
    new GetObjectCommand({
      Bucket: input.config.S3_BUCKET,
      Key: input.objectKey,
    }),
  );
  const body = await result.Body?.transformToByteArray();
  if (!body?.length) {
    throw new AppError(
      ErrorCode.UPLOAD_INVALID,
      "Uploaded object not found",
      400,
      "errors.upload_invalid",
    );
  }
  const contentType =
    result.ContentType ?? contentTypeFromObjectKey(input.objectKey) ?? "";
  if (!isAllowedUploadContentType(contentType)) {
    throw new AppError(
      ErrorCode.UPLOAD_INVALID,
      "Uploaded object has invalid content type",
      400,
      "errors.upload_invalid",
    );
  }
  return { body, contentType };
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

  const metadata = await readObjectMetadata({
    config: input.config,
    objectKey: input.objectKey,
  });

  return {
    ...metadata,
    publicUrl: publicUrlForObject(input.config, input.objectKey),
  };
}
