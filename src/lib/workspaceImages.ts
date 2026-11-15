/** Decode a still frame locally so reduced-motion backgrounds never animate. */
export async function backgroundStill(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("This browser cannot prepare background previews.");
    context.fillStyle = "#0c0d14";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Could not prepare your background preview.")),
        "image/jpeg",
        0.85,
      ),
    );
    return new File([blob], "background-still.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
