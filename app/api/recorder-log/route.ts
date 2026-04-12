import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { message } = (await request.json()) as {
      message?: string;
    };
    if (message) {
      console.log(message);
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
