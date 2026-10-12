import { NextResponse } from "next/server";
import {
  mapSlipOkError,
  parseSlipOkSuccessResponse,
  verifyReceiverAgainstSettings,
} from "@/lib/slipokAdapter";
import { bahtToSatang, satangToBaht } from "@/lib/financeTypes";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      roomId,
      dueId,
      qrData,
      claimedAmountSatang,
      memberUid,
      expectedSettings,
      mockMode = false,
    } = body;

    if (!roomId || !dueId || !memberUid) {
      return NextResponse.json(
        { error: "ข้อมูลที่จำเป็นไม่ครบถ้วน (roomId, dueId, memberUid)" },
        { status: 400 }
      );
    }

    const apiKey = process.env.SLIPOK_API_KEY;
    const branchId = process.env.SLIPOK_BRANCH_ID;
    const autoVerifyEnabled = process.env.SLIPOK_AUTOVERIFY_ENABLED === "true";

    // --- MOCK MODE (For Local Dev, Automated Tests, and Zero Cost) ---
    if (mockMode || !apiKey || !branchId || !autoVerifyEnabled) {
      // If auto-verify is disabled or missing credentials
      if (!autoVerifyEnabled && !mockMode) {
        return NextResponse.json({
          status: "manual_review",
          autoVerifyEnabled: false,
          message: "ระบบตรวจสลิปอัตโนมัติ (SlipOK) ถูกปิดใช้งานอยู่ ส่งเข้าคิวให้ผู้ดูแลตรวจสลิปด้วยตนเอง",
        });
      }

      // Generate realistic mock response based on qrData content or simulated scenarios
      if (qrData?.includes("MOCK_FAIL_1012") || qrData?.includes("DUPLICATE")) {
        const err = mapSlipOkError(1012, "สลิปซ้ำ");
        return NextResponse.json(
          {
            status: "rejected",
            code: 1012,
            error: err.thaiMessage,
            message: err.thaiMessage,
          },
          { status: 400 }
        );
      }

      if (qrData?.includes("MOCK_FAIL_1010") || qrData?.includes("DELAY")) {
        const err = mapSlipOkError(1010, "", { bankName: "ธนาคารกรุงเทพ", delay: 8 });
        return NextResponse.json(
          {
            status: "manual_review",
            code: 1010,
            delayMins: 8,
            error: err.thaiMessage,
            message: err.thaiMessage,
          },
          { status: 400 }
        );
      }

      if (qrData?.includes("MOCK_FAIL_1014") || qrData?.includes("WRONG_RECEIVER")) {
        const err = mapSlipOkError(1014);
        return NextResponse.json(
          {
            status: "manual_review",
            code: 1014,
            error: err.thaiMessage,
            message: err.thaiMessage,
          },
          { status: 400 }
        );
      }

      // Successful Mock Slip Verification
      const mockAmountThb = claimedAmountSatang ? satangToBaht(claimedAmountSatang) : 500;
      const mockResult = {
        success: true,
        transRef: `MOCK${Date.now()}`,
        transDate: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        transTime: new Date().toTimeString().slice(0, 8),
        sendingBank: "004", // KBANK
        receivingBank: expectedSettings?.receivingBank || "004",
        amount: mockAmountThb,
        amountSatang: bahtToSatang(mockAmountThb),
        sender: {
          displayName: "นาย สมาชิก ทริป",
          name: "MR. MEMBER TRIP",
          accountValue: "xxx-x-x1234-x",
          proxyValue: "081xxx1234",
        },
        receiver: {
          displayName: expectedSettings?.receivingName || "กองกลาง HoneyTrip",
          name: expectedSettings?.receivingName || "HONEYTRIP POOL",
          accountValue: expectedSettings?.receivingAccount ? `xxx-x-x${expectedSettings.receivingAccount.slice(-4)}` : "xxx-x-x9999-x",
          proxyValue: expectedSettings?.promptPayId ? `086xxx${expectedSettings.promptPayId.slice(-4)}` : "086xxx0000",
        },
        rawMessage: "✅ (Mock Verification)",
        isDuplicate: false,
        receiverMatched: true,
        matchNotes: "ผ่านการตรวจสอบจำลอง (Mock Mode)",
      };

      return NextResponse.json({
        status: "api_verified",
        verified: true,
        isMock: true,
        result: mockResult,
      });
    }

    // --- LIVE SLIPOK VERIFICATION (Strict Free-Quota Protection) ---
    // Step 1: Check quota first via GET quota endpoint
    try {
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

      if (quotaRes.ok) {
        const quotaJson = await quotaRes.json();
        const remaining = quotaJson.data?.quota ?? 0;
        const overQuota = quotaJson.data?.overQuota ?? 0;

        // Hard safety stop: preserve 2 free quota checks to guarantee zero over-spending
        if (remaining <= 2 || overQuota > 0) {
          return NextResponse.json({
            status: "manual_review",
            error: "โควต้าตรวจสลิปฟรีใกล้หมดหรือหมดแล้ว เพื่อความปลอดภัยระบบเปลี่ยนเป็นโหมดให้ผู้ดูแลตรวจด้วยตนเอง",
            quotaExhausted: true,
          });
        }
      }
    } catch {
      // If quota check fails, don't risk chargeable call
      return NextResponse.json({
        status: "manual_review",
        error: "ไม่สามารถตรวจสอบโควต้าคงเหลือของ SlipOK ได้ จึงเปลี่ยนเป็นโหมดตรวจด้วยตนเอง",
      });
    }

    // Step 2: Call SlipOK Check Slip endpoint
    const claimedThb = claimedAmountSatang ? satangToBaht(claimedAmountSatang) : undefined;
    const slipPayload: Record<string, unknown> = {
      data: qrData,
      log: true, // Required for duplicate checking and receiver account matching
    };
    if (claimedThb && claimedThb > 0) {
      slipPayload.amount = claimedThb;
    }

    const checkRes = await fetch(
      `https://api.slipok.com/api/line/apikey/${branchId}`,
      {
        method: "POST",
        headers: {
          "x-authorization": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(slipPayload),
      }
    );

    const resJson = await checkRes.json();

    if (checkRes.ok && resJson.success) {
      // Success response from SlipOK
      const parsed = parseSlipOkSuccessResponse(resJson, expectedSettings);

      // Verify recipient matching
      if (expectedSettings) {
        const matchCheck = verifyReceiverAgainstSettings({
          expectedBank: expectedSettings.receivingBank,
          expectedAccount: expectedSettings.receivingAccount,
          expectedPromptPay: expectedSettings.promptPayId,
          expectedName: expectedSettings.receivingName,
          slipReceivingBank: parsed.receivingBank,
          slipReceiverAccount: parsed.receiver?.accountValue,
          slipReceiverProxy: parsed.receiver?.proxyValue,
          slipReceiverDisplayName: parsed.receiver?.displayName,
          slipReceiverName: parsed.receiver?.name,
        });

        parsed.receiverMatched = matchCheck.matched;
        parsed.matchNotes = matchCheck.notes;

        if (!matchCheck.matched) {
          return NextResponse.json({
            status: "manual_review",
            verified: false,
            result: parsed,
            warning: matchCheck.notes,
          });
        }
      }

      return NextResponse.json({
        status: "api_verified",
        verified: true,
        result: parsed,
      });
    }

    // Error response from SlipOK
    const errorCode = resJson.code || 9999;
    const errorDetails = mapSlipOkError(errorCode, resJson.message, resJson.data);

    return NextResponse.json(
      {
        status: "manual_review",
        code: errorCode,
        error: errorDetails.thaiMessage,
        delayMins: errorDetails.delayMins,
        data: errorDetails.data,
      },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
