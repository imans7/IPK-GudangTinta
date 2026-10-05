// Dipakai di browser: kompres foto kamera sebelum dikirim ke server.
export async function compressImage(file: File): Promise<File> {
  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(file, { maxSizeMB: 1.5, maxWidthOrHeight: 1600, useWebWorker: true });
}
