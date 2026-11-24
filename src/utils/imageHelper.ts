export interface CompressedImageBlobItem {
  blob: Blob;
  previewUrl: string;
}

/**
 * Compresses an uploaded/captured image file into a JPEG Blob + preview Object URL
 * so smartphone camera photos (often 5-12MB) upload rapidly to Object Storage.
 */
async function compressImageFileToBlob(
  file: File,
  maxWidth = 1280,
  quality = 0.82
): Promise<CompressedImageBlobItem> {
  return new Promise((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth || img.width || maxWidth;
        let height = img.naturalHeight || img.height || Math.round(maxWidth * 0.65);

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(sourceUrl);
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(sourceUrl);
            if (!blob) {
              reject(new Error('Impossibile comprimere immagine.'));
              return;
            }
            const previewUrl = URL.createObjectURL(blob);
            resolve({ blob, previewUrl });
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        URL.revokeObjectURL(sourceUrl);
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(sourceUrl);
      reject(err);
    };

    img.src = sourceUrl;
  });
}

/**
 * Compresses multiple uploaded image files into Blobs in parallel without failing
 * the entire batch if a single file is invalid or unreadable.
 */
export async function compressImageFilesToBlobs(
  files: File[],
  maxWidth = 1280,
  quality = 0.82
): Promise<{ items: CompressedImageBlobItem[]; failedCount: number }> {
  const results = await Promise.allSettled(
    files.map((file) => compressImageFileToBlob(file, maxWidth, quality))
  );

  const items: CompressedImageBlobItem[] = [];
  let failedCount = 0;

  results.forEach((res) => {
    if (res.status === 'fulfilled' && res.value) {
      items.push(res.value);
    } else {
      failedCount += 1;
    }
  });

  return { items, failedCount };
}
