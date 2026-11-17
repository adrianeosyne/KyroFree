export interface CropTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export function clampCrop(value: number, min = -100, max = 100) {
  return Math.min(max, Math.max(min, value));
}

/** The preview and export use the same cover scale and bounded offsets. */
export function getCropGeometry(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  transform: CropTransform,
) {
  const scale =
    Math.max(frameWidth / imageWidth, frameHeight / imageHeight) *
    clampCrop(transform.zoom, 1, 4);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const maxShiftX = Math.max(0, (width - frameWidth) / 2);
  const maxShiftY = Math.max(0, (height - frameHeight) / 2);
  return {
    width,
    height,
    maxShiftX,
    maxShiftY,
    x: -maxShiftX + (clampCrop(transform.offsetX) / 100) * maxShiftX,
    y: -maxShiftY + (clampCrop(transform.offsetY) / 100) * maxShiftY,
  };
}
