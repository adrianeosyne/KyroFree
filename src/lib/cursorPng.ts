/** Validate static PNG structure and geometry without trusting client dimensions. */
export function cursorPngSize(bytes: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  const invalid = () => new Error("Choose a valid static PNG cursor.");
  if (
    bytes.length < 45 ||
    signature.some((value, index) => bytes[index] !== value)
  )
    throw invalid();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8,
    width = 0,
    height = 0,
    imageData = false,
    ended = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error("The PNG cursor is incomplete.");
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    let crc = 0xffffffff;
    for (let i = offset + 4; i < end - 4; i++) {
      crc ^= bytes[i];
      for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    if ((crc ^ 0xffffffff) >>> 0 !== view.getUint32(end - 4)) throw invalid();
    if (offset === 8 && (type !== "IHDR" || length !== 13)) throw invalid();
    if (type === "IHDR") {
      if (offset !== 8 || length !== 13) throw invalid();
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
    }
    if (["acTL", "fcTL", "fdAT"].includes(type))
      throw new Error("Cursor uploads must be static PNG images.");
    if (type === "IDAT" && length > 0) imageData = true;
    if (type === "IEND") {
      if (length !== 0 || end !== bytes.length) throw invalid();
      ended = true;
      break;
    }
    offset = end;
  }
  if (!imageData || !ended) throw invalid();
  if (width < 1 || height < 1 || width > 64 || height > 64)
    throw new Error("PNG cursors must be no larger than 64 × 64 pixels.");
  return { width, height };
}
