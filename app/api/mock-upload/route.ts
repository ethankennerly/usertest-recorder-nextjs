import { NextResponse } from "next/server";

export async function PUT(request: Request) {
  const payload = await request.arrayBuffer();

  return NextResponse.json({
    ok: true,
    size: payload.byteLength,
    contentType: request.headers.get("content-type") ?? "application/octet-stream"
  });
}
