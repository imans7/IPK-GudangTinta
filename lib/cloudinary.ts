// Upload unsigned ke Cloudinary lewat REST API (tanpa SDK).
export async function uploadImage(file: File, folder: string): Promise<string> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloud || !preset) throw new Error("Cloudinary belum dikonfigurasi (CLOUDINARY_CLOUD_NAME / CLOUDINARY_UPLOAD_PRESET).");
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", preset);
  body.append("folder", `ink-traceability/${folder}`);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body });
  if (!res.ok) throw new Error("Upload gambar ke Cloudinary gagal.");
  return (await res.json()).secure_url as string;
}
