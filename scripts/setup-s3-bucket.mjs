import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketOwnershipControlsCommand,
  PutPublicAccessBlockCommand,
  S3Client
} from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION || "us-east-1";
const bucket =
  process.env.AWS_S3_BUCKET ||
  `usertest-recorder-nextjs-${Date.now().toString(36)}`;

const client = new S3Client({ region });

async function bucketExists() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

if (!(await bucketExists())) {
  await client.send(
    new CreateBucketCommand(
      region === "us-east-1"
        ? { Bucket: bucket }
        : {
            Bucket: bucket,
            CreateBucketConfiguration: {
              LocationConstraint: region
            }
          }
    )
  );
}

await client.send(
  new PutBucketOwnershipControlsCommand({
    Bucket: bucket,
    OwnershipControls: {
      Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }]
    }
  })
);

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

console.log(
  JSON.stringify(
    {
      ok: true,
      bucket,
      region,
      nextStep: `RECORDER_UPLOAD_MODE=s3 AWS_S3_BUCKET=${bucket} npm run test:s3`
    },
    null,
    2
  )
);