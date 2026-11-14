export const FILE_TYPES: Record<
  string,
  { mime: string; extensions: string[] }
> = {
  png: { mime: "image/png", extensions: ["png"] },
  jpg: { mime: "image/jpeg", extensions: ["jpg", "jpeg"] },
  gif: { mime: "image/gif", extensions: ["gif"] },
  webp: { mime: "image/webp", extensions: ["webp"] },
  mp4: { mime: "video/mp4", extensions: ["mp4"] },
  webm: { mime: "video/webm", extensions: ["webm"] },
  mp3: { mime: "audio/mpeg", extensions: ["mp3"] },
  wav: { mime: "audio/wav", extensions: ["wav"] },
  ogg: { mime: "audio/ogg", extensions: ["ogg"] },
  m4a: { mime: "audio/mp4", extensions: ["m4a"] },
  pdf: { mime: "application/pdf", extensions: ["pdf"] },
  txt: { mime: "text/plain", extensions: ["txt", "md", "json"] },
  csv: { mime: "text/csv", extensions: ["csv"] },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: ["docx"],
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: ["xlsx"],
  },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extensions: ["pptx"],
  },
  zip: { mime: "application/zip", extensions: ["zip"] },
};
export const ACCEPTED_FILES = Object.values(FILE_TYPES)
  .flatMap((t) => t.extensions.map((e) => `.${e}`))
  .join(",");
export function cleanFilename(name: string) {
  // Filenames must not contain control bytes or path separators.
  return (
    name
      // eslint-disable-next-line no-control-regex
      .replace(/[/\\\u0000-\u001f\u007f]/g, "_")
      .replace(/^[. ]+/, "")
      .trim()
      .slice(0, 120) || "upload.txt"
  );
}
export function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}
export function allowedFilename(name: string, allowlist?: string) {
  const ext = fileExtension(name);
  const allowed = allowlist
    ? allowlist.split(",").map((s) => s.trim().toLowerCase())
    : Object.values(FILE_TYPES).flatMap((t) => t.extensions);
  return (
    allowed.includes(ext) &&
    Object.values(FILE_TYPES).some((t) => t.extensions.includes(ext))
  );
}
