import { fileTypeFromBuffer } from "file-type";
import { unzipSync } from "fflate";
import {
  FILE_TYPES,
  allowedFilename,
  fileExtension,
} from "../../src/lib/filePolicy";

/** Validate bytes and extension; never accept executable, SVG or HTML payloads. */
export async function inspectFile(
  bytes: Uint8Array,
  name: string,
  declared: string,
  allowlist?: string,
): Promise<string> {
  if (!bytes.length || !allowedFilename(name, allowlist))
    throw new Error("UNSUPPORTED_FILE");
  const ext = fileExtension(name);
  if (
    (bytes[0] === 0x4d && bytes[1] === 0x5a) ||
    (bytes[0] === 0x7f && bytes[1] === 0x45) ||
    String.fromCharCode(...bytes.slice(0, 2)) === "#!"
  )
    throw new Error("EXECUTABLE_FILE");
  const detected = await fileTypeFromBuffer(bytes);
  let mime: string;
  if (["txt", "md", "csv", "json"].includes(ext)) {
    if (detected || bytes.includes(0))
      throw new Error("FILE_SIGNATURE_MISMATCH");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (/<\s*(?:html|script|svg|iframe|object)\b/i.test(text))
      throw new Error("ACTIVE_CONTENT");
    if (ext === "json") JSON.parse(text);
    mime =
      ext === "csv"
        ? "text/csv"
        : ext === "json"
          ? "application/json"
          : ext === "md"
            ? "text/markdown"
            : "text/plain";
  } else if (["docx", "xlsx", "pptx", "zip"].includes(ext)) {
    if (!detected || !["zip", "docx", "xlsx", "pptx"].includes(detected.ext))
      throw new Error("FILE_SIGNATURE_MISMATCH");
    // Inspect the central directory first: do not inflate user archives or ZIP bombs.
    let count = 0,
      inflated = 0;
    const names: string[] = [];
    for (let i = 0; i + 46 < bytes.length; i++) {
      if (
        bytes[i] !== 0x50 ||
        bytes[i + 1] !== 0x4b ||
        bytes[i + 2] !== 1 ||
        bytes[i + 3] !== 2
      )
        continue;
      const view = new DataView(
        bytes.buffer,
        bytes.byteOffset + i,
        bytes.length - i,
      );
      const size = view.getUint32(24, true),
        length = view.getUint16(28, true);
      if (i + 46 + length > bytes.length) throw new Error("INVALID_ARCHIVE");
      inflated += size;
      count++;
      const entry = new TextDecoder().decode(
        bytes.slice(i + 46, i + 46 + length),
      );
      names.push(entry);
      if (
        count > 2000 ||
        inflated > 100 * 1024 * 1024 ||
        /(^|[/\\])\.\.([/\\]|$)|^[/\\]|^[a-z]:|\.(?:exe|dll|bat|cmd|com|scr|ps1|vbs|js|jar|msi)$|vbaProject\.bin$/i.test(
          entry,
        )
      )
        throw new Error("UNSAFE_ARCHIVE");
      i += 45 + length + view.getUint16(30, true) + view.getUint16(32, true);
    }
    if (!count) throw new Error("INVALID_ARCHIVE");
    if (ext !== "zip") {
      const part =
        ext === "docx"
          ? "word/document.xml"
          : ext === "xlsx"
            ? "xl/workbook.xml"
            : "ppt/presentation.xml";
      if (!names.includes(part) || !names.includes("[Content_Types].xml"))
        throw new Error("FILE_SIGNATURE_MISMATCH");
      const manifests = unzipSync(bytes, {
        filter: (entry) =>
          entry.name === "[Content_Types].xml" && entry.originalSize <= 65536,
      });
      if (
        !manifests["[Content_Types].xml"] ||
        /macroEnabled|vbaProject/i.test(
          new TextDecoder().decode(manifests["[Content_Types].xml"]),
        )
      )
        throw new Error("UNSAFE_ARCHIVE");
    }
    mime = FILE_TYPES[ext].mime;
  } else {
    if (!detected) throw new Error("FILE_SIGNATURE_MISMATCH");
    const type = Object.values(FILE_TYPES).find((t) =>
      t.extensions.includes(ext),
    );
    if (!type) throw new Error("UNSUPPORTED_FILE");
    const aliases: Record<string, string[]> = {
      "image/jpeg": ["image/jpeg"],
      "audio/wav": ["audio/wav", "audio/x-wav"],
      "audio/mp4": ["audio/mp4", "video/mp4", "audio/x-m4a"],
      "audio/ogg": ["audio/ogg", "application/ogg", "audio/opus"],
      "video/webm": ["video/webm", "audio/webm"],
    };
    if (!(aliases[type.mime] ?? [type.mime]).includes(detected.mime))
      throw new Error("FILE_SIGNATURE_MISMATCH");
    mime =
      ext === "webm" && declared.startsWith("audio/")
        ? "audio/webm"
        : type.mime;
  }
  return mime;
}
