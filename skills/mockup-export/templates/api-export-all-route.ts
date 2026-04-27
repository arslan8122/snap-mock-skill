import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

interface ExportAllRequest {
  pngs: string[];
}

export async function POST(request: NextRequest) {
  const { pngs } = (await request.json()) as ExportAllRequest;

  if (!Array.isArray(pngs) || pngs.length === 0) {
    return NextResponse.json({ error: "pngs must be a non-empty array of dataURLs" }, { status: 400 });
  }

  const zip = new JSZip();
  pngs.forEach((dataUrl, i) => {
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    const slot = String(i + 1).padStart(2, "0");
    zip.file(`slot-${slot}.png`, b64, { base64: true });
  });

  const buf = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="mockups.zip"',
      "Content-Length": String(buf.length),
    },
  });
}
