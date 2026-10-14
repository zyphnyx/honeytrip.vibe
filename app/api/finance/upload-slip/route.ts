import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { put } from "@vercel/blob";
import { authenticateServerRequest, validateRoomAccess } from "@/lib/serverAuth";

// Maximum upload file size: 2MB (well above ~400KB compressed size)
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const user = await authenticateServerRequest(request);

    // 2. Parse FormData
    const formData = await request.formData();
    const roomId = formData.get("roomId")?.toString().trim();
    const paymentId = formData.get("paymentId")?.toString().trim();
    const file = formData.get("file");

    if (!roomId) {
      return NextResponse.json({ error: "missing_room_id", message: "กรุณาระบุรหัสห้องทริป" }, { status: 400 });
    }

    if (!paymentId) {
      return NextResponse.json({ error: "missing_payment_id", message: "กรุณาระบุรหัสการแจ้งโอน" }, { status: 400 });
    }

    if (!file || typeof file === "string" || !(file instanceof Blob)) {
      return NextResponse.json({ error: "missing_file", message: "กรุณาแนบไฟล์รูปภาพสลิป" }, { status: 400 });
    }

    // 3. Validate Room Authorization & Non-Archived status
    try {
      await validateRoomAccess(roomId, user.uid, true);
    } catch (authErr: unknown) {
      return NextResponse.json(
        { error: "forbidden", message: authErr instanceof Error ? authErr.message : "ไม่มีสิทธิ์เข้าถึงห้องทริปนี้" },
        { status: 403 }
      );
    }

    // 4. Validate file type and size
    const mimeType = file.type || "image/jpeg";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: "invalid_mime_type", message: "รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WebP เท่านั้น" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "file_too_large", message: "ไฟล์รูปภาพมีขนาดใหญ่เกิน 2 MB กรุณาลดขนาดภาพก่อนอัปโหลด" },
        { status: 400 }
      );
    }

    // 5. Check Blob Storage Configuration
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error: "storage_not_configured",
          message: "ยังไม่ได้เชื่อมต่อ Vercel Blob Storage ในระบบ คุณสามารถแจ้งโอนโดยไม่แนบรูป แล้วส่งสลิปผ่านแชทได้ครับ",
        },
        { status: 503 }
      );
    }

    // Compute SHA-256 for duplicate evidence detection
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    // 6. Upload to Vercel Blob Private
    const randomFileId = crypto.randomUUID().replace(/-/g, "");
    const pathname = `slips/${roomId}/${paymentId}/${randomFileId}.jpg`;

    let blob;
    try {
      blob = await put(pathname, buffer, {
        access: "private",
        contentType: mimeType,
      });
    } catch (blobErr: unknown) {
      const errMsg = blobErr instanceof Error ? blobErr.message : String(blobErr);
      console.error("Vercel Blob upload failed:", errMsg);

      return NextResponse.json(
        {
          error: "storage_error",
          message:
            "ไม่สามารถอัปโหลดไปยัง Vercel Blob ได้ (โควต้าเต็ม หรือยังไม่ได้ตั้งค่า Token) คุณสามารถเลือกแจ้งโอนโดยไม่แนบรูปภาพได้ครับ",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      evidence: {
        storageProvider: "vercel_blob",
        blobPath: blob.pathname,
        contentType: blob.contentType,
        sizeBytes: buffer.length,
        sha256,
        uploadedAt: Date.now(),
      },
    });
  } catch (err: unknown) {
    console.error("Upload slip handler error:", err);
    return NextResponse.json(
      { error: "internal_error", message: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอัปโหลดสลิป" },
      { status: 500 }
    );
  }
}
