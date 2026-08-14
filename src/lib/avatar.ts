/**
 * Turning a file off the device into something small enough to live in the
 * settings document.
 *
 * A phone photo is 3–8MB and 4000px wide; the largest it is ever drawn is
 * 44px. Everything here exists to close that gap before the bytes reach
 * storage, because the raw file would blow the 1MB document ceiling and the
 * raw pixels would be 99.9% waste.
 */

/** 192 rather than 88: enough for a 44px avatar on a 3× phone screen. */
const SIDE = 192;

/** Comfortably under Firestore's 1MB field ceiling, with room for the rest. */
const MAX_CHARS = 300_000;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file couldn't be read as an image."));
    img.src = url;
  });
}

/**
 * Centre-crops to a square and re-encodes at `SIDE`px.
 *
 * The crop happens here rather than with `object-fit` at render time so the
 * stored bytes match what is drawn — a 16:9 photo squeezed into a circle by
 * CSS is still a 16:9 photo in storage, and every other surface that touches
 * it has to remember to crop it the same way.
 */
export async function fileToAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Pick an image file.');
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error("That file couldn't be read as an image.");

    const canvas = document.createElement('canvas');
    canvas.width = SIDE;
    canvas.height = SIDE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("This browser couldn't process that image.");

    ctx.drawImage(
      img,
      (img.naturalWidth - side) / 2,
      (img.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      SIDE,
      SIDE,
    );

    // JPEG, not PNG: a photograph as PNG is roughly 10× the bytes for no
    // visible gain at this size, and transparency is moot inside a circle.
    let out = canvas.toDataURL('image/jpeg', 0.82);
    if (out.length > MAX_CHARS) out = canvas.toDataURL('image/jpeg', 0.6);
    if (out.length > MAX_CHARS) throw new Error("That image wouldn't compress small enough.");
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
