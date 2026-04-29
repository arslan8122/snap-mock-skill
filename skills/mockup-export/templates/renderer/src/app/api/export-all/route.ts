import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

interface ExportAllRequest {
  pngs: string[];
  // Phase FG: optional 1024×500 banner. Sent as a data URL alongside the 6 slot pngs.
  // When present, zipped as feature-graphic.png. Backwards compatible: callers
  // that don't send the field continue to get a 6-file zip.
  featureGraphic?: string;
}

export async function POST(request: NextRequest) {
  const { pngs, featureGraphic } = (await request.json()) as ExportAllRequest;

  if (!Array.isArray(pngs) || pngs.length === 0) {
    return NextResponse.json({ error: "pngs must be a non-empty array of dataURLs" }, { status: 400 });
  }

  const zip = new JSZip();
  pngs.forEach((dataUrl, i) => {
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    const slot = String(i + 1).padStart(2, "0");
    zip.file(`slot-${slot}.png`, b64, { base64: true });
  });
  if (typeof featureGraphic === "string" && featureGraphic.startsWith("data:image/png;base64,")) {
    const b64 = featureGraphic.replace(/^data:image\/png;base64,/, "");
    zip.file("feature-graphic.png", b64, { base64: true });
  }

  const buf = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="mockups.zip"',
      "Content-Length": String(buf.length),
    },
  });
}
