/**
 * 🖼️ HoneyTrip Browser Image Compression
 * Compresses bank slip images on the client side before uploading to Vercel Blob Private.
 * Keeps text crisp (1200-1600px) while maintaining small file size (~300-800KB).
 */

export interface CompressedImageResult {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  sha256Hex: string;
}

/**
 * Compresses an image file in the browser using HTMLCanvasElement.
 */
export async function compressSlipImage(
  file: File,
  maxDimension = 1600,
  targetQuality = 0.82
): Promise<CompressedImageResult> {
  const isHeic =
    file.type.includes("heic") ||
    file.type.includes("heif") ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif");

  if (!file.type.startsWith("image/") && !isHeic) {
    throw new Error("ไฟล์ที่เลือกไม่ใช่รูปภาพ กรุณาเลือกไฟล์ JPG, PNG หรือ WebP");
  }

  // Load image
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const element = new window.Image();
    element.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(element);
    };
    element.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      if (isHeic) {
        reject(
          new Error(
            "เบราว์เซอร์นี้ไม่รองรับไฟล์รูปภาพแบบ HEIC โดยตรง กรุณาแคปหน้าจอ (Screenshot) หรือแปลงเป็น JPG/PNG ก่อนเลือกรูป"
          )
        );
      } else {
        reject(new Error("ไม่สามารถเปิดอ่านไฟล์รูปภาพได้"));
      }
    };
    element.src = objectUrl;
  });

  // Calculate scaled dimensions preserving aspect ratio
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  // Draw to canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("ระบบประมวลผลกราฟิกของเบราว์เซอร์ไม่พร้อมใช้งาน");
  }

  // Enable high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  // First pass compression
  let blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", targetQuality);
  });

  if (!blob) {
    throw new Error("การบีบอัดรูปภาพล้มเหลว");
  }

  // If still larger than 1.2 MB, do a second pass with slightly lower quality
  if (blob.size > 1.2 * 1024 * 1024) {
    const secondPass = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.7);
    });
    if (secondPass && secondPass.size < blob.size) {
      blob = secondPass;
    }
  }

  // Hard limit: 1.5 MB after compression
  if (blob.size > 1.5 * 1024 * 1024) {
    throw new Error("รูปภาพมีขนาดใหญ่เกินไปแม้จะบีบอัดแล้ว กรุณาครอปภาพหรือเลือกภาพอื่น");
  }

  // Calculate SHA-256 for duplicate evidence detection
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const sanitizedFileName = file.name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 30) + ".jpg";

  const compressedFile = new File([blob], sanitizedFileName || "slip.jpg", {
    type: "image/jpeg",
  });

  const previewUrl = URL.createObjectURL(blob);

  return {
    file: compressedFile,
    previewUrl,
    width,
    height,
    originalSizeBytes: file.size,
    compressedSizeBytes: blob.size,
    sha256Hex: hashHex,
  };
}

/**
 * Format bytes to readable Thai string (e.g. "450 KB", "1.2 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
