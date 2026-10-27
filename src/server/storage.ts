import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
export const bucket = process.env.S3_BUCKET ?? "hai-moldova";
export function storage() {
  return new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
  });
}
export async function initializeStorage() {
  const client = storage();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (error) {
    if (
      (error as { $metadata?: { httpStatusCode: number } }).$metadata
        ?.httpStatusCode !== 404
    )
      throw error;
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}
export async function putImage(key: string, image: Buffer) {
  await storage().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: image,
      ContentType: "image/webp",
    }),
  );
}
export async function getImage(key: string) {
  return storage().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
}
