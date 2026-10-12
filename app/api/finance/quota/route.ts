import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.SLIPOK_API_KEY;
    const branchId = process.env.SLIPOK_BRANCH_ID;
    const autoVerifyEnabled = process.env.SLIPOK_AUTOVERIFY_ENABLED === "true";

    if (!apiKey || !branchId) {
      return NextResponse.json({
        configured: false,
        autoVerifyEnabled,
        quota: null,
        message: "ยังไม่ได้ตั้งค่า SLIPOK_API_KEY หรือ SLIPOK_BRANCH_ID",
      });
    }

    const quotaRes = await fetch(
      `https://api.slipok.com/api/line/apikey/${branchId}/quota`,
      {
        method: "GET",
        headers: {
          "x-authorization": apiKey,
        },
        cache: "no-store",
      }
    );

    if (!quotaRes.ok) {
      const errJson = await quotaRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          configured: true,
          autoVerifyEnabled,
          error: "ไม่สามารถดึงข้อมูลโควต้าได้: " + (errJson.message || quotaRes.statusText),
        },
        { status: quotaRes.status }
      );
    }

    const resJson = await quotaRes.json();
    return NextResponse.json({
      configured: true,
      autoVerifyEnabled,
      quota: resJson.data?.quota ?? 0,
      overQuota: resJson.data?.overQuota ?? 0,
      specialQuota: resJson.data?.specialQuota ?? 0,
      endDate: resJson.data?.endDate ?? null,
      specialEndDate: resJson.data?.specialEndDate ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "ข้อผิดพลาดระบบ: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
