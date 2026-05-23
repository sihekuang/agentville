import { NextResponse } from "next/server";
import { execFile } from "child_process";
import fs from "fs";

export async function POST(req: Request): Promise<Response> {
  const { path } = await req.json();

  if (typeof path !== "string" || !fs.existsSync(path)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  return new Promise((resolve) => {
    execFile("open", [path], (err) => {
      if (err) {
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      } else {
        resolve(NextResponse.json({ ok: true }));
      }
    });
  });
}
