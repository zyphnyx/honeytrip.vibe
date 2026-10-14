import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { firebaseAdmin } from "@/lib/firebaseAdmin";
import { authenticateServerRequest, validateRoomAccess } from "@/lib/serverAuth";
import type { Payment } from "@/lib/financeTypes";

export async function GET(
  request: Request,
  props: { params: Promise<{ roomId: string; paymentId: string }> }
) {
  const { roomId, paymentId } = await props.params;

  try {
    // 1. Authenticate user
    const user = await authenticateServerRequest(request);

    // 2. Validate Room Access (archived rooms are allowed to view historical evidence)
    try {
      await validateRoomAccess(roomId, user.uid, false);
    } catch (authErr: unknown) {
      return NextResponse.json(
        { error: "forbidden", message: authErr instanceof Error ? authErr.message : "ไม่มีสิทธิ์เข้าถึงห้องทริปนี้" },
        { status: 403 }
      );
    }

    // 3. Resolve payment document from Firestore
    const { db } = firebaseAdmin();
    const paymentSnap = await db.doc(`rooms/${roomId}/payments/${paymentId}`).get();

    if (!paymentSnap.exists) {
      return NextResponse.json({ error: "not_found", message: "ไม่พบรายการแจ้งโอนเงิน" }, { status: 404 });
    }

    const payment = paymentSnap.data() as Payment;

    if (!payment.evidence || !payment.evidence.blobPath) {
      return NextResponse.json(
        { error: "no_evidence", message: "รายการแจ้งโอนนี้ไม่มีไฟล์แนบรูปภาพสลิป" },
        { status: 404 }
      );
    }

    // 4. Check that blobPath matches the current room and payment to prevent path traversal
    const expectedPrefix = `slips/${roomId}/${paymentId}/`;
    if (!payment.evidence.blobPath.startsWith(expectedPrefix)) {
      console.warn("Security Alert: Evidence blobPath mismatch", {
        stored: payment.evidence.blobPath,
        expectedPrefix,
      });
      return NextResponse.json({ error: "invalid_path", message: "เส้นทางไฟล์ไม่ถูกต้อง" }, { status: 403 });
    }

    // 5. Fetch private blob via Vercel Blob SDK
    try {
      const blobResult = await get(payment.evidence.blobPath, { access: "private" });

      if (!blobResult || blobResult.statusCode !== 200 || !blobResult.stream) {
        return NextResponse.json(
          { error: "blob_not_found", message: "ไม่พบไฟล์สลิปในพื้นที่จัดเก็บ" },
          { status: 404 }
        );
      }

      const contentType =
        (blobResult.headers && blobResult.headers.get("content-type")) ||
        payment.evidence.contentType ||
        payment.evidence.mimeType ||
        "image/jpeg";

      return new Response(blobResult.stream, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (blobErr: unknown) {
      console.error("Vercel Blob get failed:", blobErr);
      return NextResponse.json(
        {
          error: "storage_error",
          message: "ไม่สามารถเปิดไฟล์รูปภาพจาก Vercel Blob ได้ (อาจยังไม่ได้ตั้งค่า Token หรือไฟล์ถูกลบ)",
        },
        { status: 503 }
      );
    }
  } catch (err: unknown) {
    console.error("Evidence retrieval route error:", err);
    return NextResponse.json(
      { error: "internal_error", message: err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการดึงไฟล์สลิป" },
      { status: 500 }
    );
  }
}
