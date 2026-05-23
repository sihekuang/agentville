import { NextResponse } from "next/server";
import fs from "fs";
import { getPlatform } from "@/lib/platform";

export async function POST(req: Request): Promise<Response> {
  const { path } = await req.json();

  if (typeof path !== "string" || !fs.existsSync(path)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const result = getPlatform().openDirectory(path);

  if (!result.success) {
    return NextResponse.json(
      { error: "Failed to open directory" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
