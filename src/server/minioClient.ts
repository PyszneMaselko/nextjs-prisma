import { CreateBucketCommand, DeleteObjectsCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? "";
const SECRET_KEY = process.env.MINIO_SECRET_KEY ?? "";

export const BUCKET = process.env.MINIO_BUCKET ?? "policy-checker";

// On Railway RAILWAY_ENVIRONMENT is set, so server-to-MinIO calls use the private endpoint.
// Everywhere else (localhost dev) fall back to the public endpoint.
const serverEndpoint =
  process.env.RAILWAY_ENVIRONMENT
    ? process.env.MINIO_PRIVATE_ENDPOINT
    : process.env.MINIO_PUBLIC_ENDPOINT;

// Presigned URLs are consumed by the browser, so they must always point to the public endpoint.
const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT;

// True only when object storage is actually configured. When it is not (e.g. a local demo run
// without MinIO credentials) uploads degrade gracefully to metadata-only attachments instead of
// failing, so the rest of the flow (DPA re-evaluation, audit trail) keeps working.
export const isStorageConfigured = Boolean(publicEndpoint && ACCESS_KEY && SECRET_KEY);

const clientConfig = (endpoint: string | undefined) => ({
  endpoint,
  region: "us-east-1",
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
});

export const serverS3 = new S3Client(clientConfig(serverEndpoint));
export const publicS3 = new S3Client(clientConfig(publicEndpoint));

let bucketReady = false;
export async function ensureBucket() {
  if (bucketReady) return;
  try {
    await serverS3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await serverS3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
  bucketReady = true;
}

export async function deleteStorageObjects(storageKeys: string[]) {
  const keys = storageKeys.filter(k => k && !k.startsWith("metadata:"));
  if (keys.length === 0) return;

  // S3 DeleteObjects accepts up to 1000 keys per request
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    await serverS3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: batch.map(Key => ({ Key })), Quiet: true },
      }),
    );
  }
}
