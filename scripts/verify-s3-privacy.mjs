import { HeadObjectCommand, PutPublicAccessBlockCommand, S3Client } from "@aws-sdk/client-s3";

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION;
const key = process.argv[2];

if (!bucket || !region || !key) {
  console.error("Usage: node scripts/verify-s3-privacy.mjs <s3-key>");
  console.error("Requires AWS_S3_BUCKET and AWS_REGION environment variables.");
  process.exit(1);
}

const client = new S3Client({ region });

await client.send(
  new PutPublicAccessBlockCommand({
    Bucket: bucket,
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      IgnorePublicAcls: true,
      BlockPublicPolicy: true,
      RestrictPublicBuckets: true
    }
  })
);

const head = await client.send(
  new HeadObjectCommand({
    Bucket: bucket,
    Key: key
  })
);

const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
const response = await fetch(publicUrl);

if (response.ok) {
  console.error(`Expected private object, but public GET succeeded: ${publicUrl}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      bucket,
      key,
      status: response.status,
      contentLength: head.ContentLength ?? null
    },
    null,
    2
  )
);