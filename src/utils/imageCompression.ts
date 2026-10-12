export function compressUploadedImage(file: File, maxDimension = 1600, quality = 0.86): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not prepare uploaded image'));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      // Keep PNG for transparent signatures/stamps because react-pdf supports
      // PNG/JPEG reliably; use JPEG compression for opaque photos/logos.
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const result = canvas.toDataURL(outputType, quality);
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read uploaded image'));
    };
    image.src = objectUrl;
  });
}
