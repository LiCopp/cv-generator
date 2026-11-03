import type { Layout } from '@cv/core';

/**
 * Resolve object-position inside the portrait's inner frame, excluding its border.
 * Native percentage alignment has no visible effect when an axis fits exactly.
 * On that axis, a physical translation allows deliberate panning; keep the epsilon
 * and neutral 50% case to avoid introducing an offset through floating-point noise.
 */
export function photoObjectPosition(
  appearance: Layout['appearance'],
  imageWidth: number,
  imageHeight: number,
): string {
  const { photoWidthMm, photoShape, photoBorderWidthMm, photoFit, photoPositionX, photoPositionY } =
    appearance;
  if (imageWidth <= 0 || imageHeight <= 0) return `${photoPositionX}% ${photoPositionY}%`;
  const width = photoWidthMm - 2 * photoBorderWidthMm;
  const height =
    (photoShape === 'circle' ? photoWidthMm : (photoWidthMm * 40) / 34) - 2 * photoBorderWidthMm;
  const scale = (photoFit === 'contain' ? Math.min : Math.max)(
    width / imageWidth,
    height / imageHeight,
  );
  const axis = (position: number, frame: number, rendered: number) => {
    if (Math.abs(frame - rendered) > 0.00001 || position === 50) return `${position}%`;
    return `calc(50% + ${(((position - 50) * frame) / 100).toFixed(6)}mm)`;
  };
  return `${axis(photoPositionX, width, imageWidth * scale)} ${axis(photoPositionY, height, imageHeight * scale)}`;
}
