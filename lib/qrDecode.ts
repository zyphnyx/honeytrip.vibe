"use client";

import { BrowserQRCodeReader } from "@zxing/library";

export interface QrDecodeResult {
  success: boolean;
  payload?: string;
  error?: string;
}

/**
 * Decodes a bank slip QR code from an image File on the client side using ZXing.
 * Disposes temporary object URLs safely.
 */
export async function decodeSlipQrFromImage(file: File): Promise<QrDecodeResult> {
  if (typeof window === "undefined") {
    return { success: false, error: "ฟังก์ชันนี้ทำงานบนเบราว์เซอร์เท่านั้น" };
  }

  if (!file || !file.type.startsWith("image/")) {
    return { success: false, error: "กรุณาเลือกไฟล์ภาพสลิป (.jpg, .jpeg, .png, .webp)" };
  }

  const objectUrl = URL.createObjectURL(file);
  const codeReader = new BrowserQRCodeReader();

  try {
    const result = await codeReader.decodeFromImageUrl(objectUrl);
    const text = result ? result.getText().trim() : "";

    if (!text) {
      return {
        success: false,
        error: "ไม่พบ QR Code ในภาพสลิป หรือภาพอาจเบลอเกินไป",
      };
    }

    return {
      success: true,
      payload: text,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // NotFoundException is standard in ZXing when no QR is detected in image
    if (msg.includes("NotFoundException") || msg.includes("No MultiFormat Readers were able to detect the code")) {
      return {
        success: false,
        error: "ไม่พบ QR Code ในภาพสลิป กรุณาตรวจสอบว่ามี QR Code อยู่ที่มุมขวาล่างของสลิปหรือไม่",
      };
    }
    return {
      success: false,
      error: "เกิดข้อผิดพลาดในการอ่าน QR Code จากภาพ: " + msg,
    };
  } finally {
    // Clean up temporary blob URL to free memory
    URL.revokeObjectURL(objectUrl);
  }
}
