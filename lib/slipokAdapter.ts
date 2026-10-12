import { bahtToSatang, type SlipVerificationResult } from "./financeTypes.ts";

export const THAI_BANK_CODES: Record<string, { shortName: string; fullName: string }> = {
  "002": { shortName: "BBL", fullName: "ธนาคารกรุงเทพ" },
  "004": { shortName: "KBANK", fullName: "ธนาคารกสิกรไทย" },
  "006": { shortName: "KTB", fullName: "ธนาคารกรุงไทย" },
  "011": { shortName: "TTB", fullName: "ธนาคารทหารไทยธนชาต" },
  "014": { shortName: "SCB", fullName: "ธนาคารไทยพาณิชย์" },
  "025": { shortName: "BAY", fullName: "ธนาคารกรุงศรีอยุธยา" },
  "069": { shortName: "KKP", fullName: "ธนาคารเกียรตินาคินภัทร" },
  "022": { shortName: "CIMBT", fullName: "ธนาคารซีไอเอ็มบีไทย" },
  "067": { shortName: "TISCO", fullName: "ธนาคารทิสโก้" },
  "024": { shortName: "UOBT", fullName: "ธนาคารยูโอบี" },
  "071": { shortName: "TCD", fullName: "ธนาคารไทยเครดิต" },
  "073": { shortName: "LHFG", fullName: "ธนาคารแลนด์ แอนด์ เฮ้าส์" },
  "070": { shortName: "ICBCT", fullName: "ธนาคารไอซีบีซี (ไทย)" },
  "098": { shortName: "SME", fullName: "ธนาคารพัฒนาวิสาหกิจขนาดกลางและขนาดย่อมฯ" },
  "034": { shortName: "BAAC", fullName: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร" },
  "035": { shortName: "EXIM", fullName: "ธนาคารเพื่อการส่งออกและนำเข้าฯ" },
  "030": { shortName: "GSB", fullName: "ธนาคารออมสิน" },
  "033": { shortName: "GHB", fullName: "ธนาคารอาคารสงเคราะห์" },
};

export function getBankName(bankCode: string): string {
  const code = bankCode.padStart(3, "0");
  return THAI_BANK_CODES[code]?.fullName || `ธนาคารรหัส ${code}`;
}

export function getBankShortName(bankCode: string): string {
  const code = bankCode.padStart(3, "0");
  return THAI_BANK_CODES[code]?.shortName || code;
}

export interface SlipOkErrorDetails {
  code: number;
  thaiMessage: string;
  isRetryable: boolean;
  delayMins?: number;
  data?: Record<string, unknown>;
}

export function mapSlipOkError(
  code: number,
  rawMessage?: string,
  data?: Record<string, unknown>
): SlipOkErrorDetails {
  switch (code) {
    case 1000:
      return { code, thaiMessage: "ข้อมูล QR Code ไม่ครบถ้วนหรือไม่ถูกต้อง", isRetryable: false, data };
    case 1001:
      return { code, thaiMessage: "ไม่พบข้อมูลสาขา SlipOK กรุณาตรวจสอบ Branch ID", isRetryable: false, data };
    case 1002:
      return { code, thaiMessage: "รหัส API Key ของ SlipOK ไม่ถูกต้อง", isRetryable: false, data };
    case 1003:
      return { code, thaiMessage: "แพ็กเกจ SlipOK หมดอายุแล้ว", isRetryable: false, data };
    case 1004:
      return { code, thaiMessage: "แพ็กเกจ SlipOK มีการใช้งานเกินโควต้า", isRetryable: false, data };
    case 1005:
      return { code, thaiMessage: "ไฟล์ที่ส่งไม่ใช่รูปภาพที่รองรับ (.jpg, .jpeg, .png, .webp)", isRetryable: false, data };
    case 1006:
      return { code, thaiMessage: "รูปภาพสลิปไม่ถูกต้อง", isRetryable: false, data };
    case 1007:
      return { code, thaiMessage: "รูปภาพไม่มี QR Code หรือ QR หมดอายุ/ไม่มีรายการจริง", isRetryable: false, data };
    case 1008:
      return { code, thaiMessage: "QR Code นี้ไม่ใช่ QR สำหรับตรวจสอบการชำระเงินของธนาคาร", isRetryable: false, data };
    case 1009:
      return {
        code,
        thaiMessage: "ข้อมูลธนาคารขัดข้องชั่วคราว กรุณาตรวจใหม่อีกครั้งใน 15 นาที (ไม่เสียโควต้า)",
        isRetryable: true,
        delayMins: 15,
        data,
      };
    case 1010: {
      const delay = typeof data?.delay === "number" ? data.delay : 8;
      const bank = typeof data?.bankName === "string" ? data.bankName : "ธนาคาร";
      return {
        code,
        thaiMessage: `สลิปจาก${bank} ต้องรอการอัปเดตระบบประมาณ ${delay} นาทีหลังโอน จึงจะสามารถตรวจได้`,
        isRetryable: true,
        delayMins: delay,
        data,
      };
    }
    case 1011:
      return { code, thaiMessage: "QR Code หมดอายุ หรือไม่พบรายการโอนในระบบธนาคาร", isRetryable: false, data };
    case 1012:
      return {
        code,
        thaiMessage: "สลิปซ้ำ สลิปนี้เคยถูกส่งตรวจเข้ามาในระบบแล้ว",
        isRetryable: false,
        data,
      };
    case 1013:
      return { code, thaiMessage: "ยอดเงินที่ส่งตรวจไม่ตรงกับยอดเงินจริงในสลิป", isRetryable: false, data };
    case 1014:
      return { code, thaiMessage: "บัญชีผู้รับเงินไม่ตรงกับบัญชีหลักที่ลงทะเบียนไว้", isRetryable: false, data };
    case 1015:
      return { code, thaiMessage: "ไม่พบข้อมูลแพ็กเกจ SlipOK", isRetryable: false, data };
    default:
      return {
        code,
        thaiMessage: rawMessage || "เกิดข้อผิดพลาดในการตรวจสอบสลิป",
        isRetryable: false,
        data,
      };
  }
}

/**
 * Normalizes an account number or phone number by removing hyphens, spaces, and formatting
 */
export function normalizeAccountString(val?: string | null): string {
  if (!val) return "";
  return val.replace(/[^0-9a-zA-Z]/g, "").toLowerCase();
}

/**
 * Compares an unmasked expected account number with a masked slip account number (e.g. xxx-x-x3109-x or 086xxx0000)
 * As documented in page 8 of SlipOK v1.13 API guide.
 */
export function matchMaskedAccount(expected: string, maskedSlipAccount: string): boolean {
  const normExpected = normalizeAccountString(expected);
  const normMasked = normalizeAccountString(maskedSlipAccount);

  if (!normExpected || !normMasked) return false;

  // If length does not match, check if visible unmasked digits match as a substring
  if (normExpected.length !== normMasked.length) {
    const digitsOnly = normMasked.replace(/x/g, "");
    if (digitsOnly.length >= 3 && normExpected.includes(digitsOnly)) {
      return true;
    }
    return false;
  }

  // Compare position by position; skip 'x'
  for (let i = 0; i < normMasked.length; i++) {
    const charSlip = normMasked[i];
    const charExp = normExpected[i];
    if (charSlip !== "x" && charSlip !== charExp) {
      return false;
    }
  }

  return true;
}

/**
 * Compares recipient name using case-insensitive substring matching
 * Accounts for bank truncation (e.g. "นาย สวัสดีครับ" -> "นาย สวัสดีค")
 */
export function matchReceiverName(expectedName: string, slipName?: string | null): boolean {
  if (!expectedName || !slipName) return true; // lenient if one is absent

  const clean = (s: string) =>
    s
      .replace(/นาย|นาง|น\.ส\.|นางสาว|mr\.|mrs\.|ms\./gi, "")
      .replace(/\s+/g, "")
      .toLowerCase();

  const exp = clean(expectedName);
  const slip = clean(slipName);

  if (!exp || !slip) return true;

  return exp.includes(slip) || slip.includes(exp);
}

/**
 * Complete matching verification against configured finance settings
 */
export function verifyReceiverAgainstSettings({
  expectedBank,
  expectedAccount,
  expectedPromptPay,
  expectedName,
  slipReceivingBank,
  slipReceiverAccount,
  slipReceiverProxy,
  slipReceiverDisplayName,
  slipReceiverName,
}: {
  expectedBank?: string;
  expectedAccount?: string;
  expectedPromptPay?: string | null;
  expectedName?: string;
  slipReceivingBank?: string;
  slipReceiverAccount?: string | null;
  slipReceiverProxy?: string | null;
  slipReceiverDisplayName?: string | null;
  slipReceiverName?: string | null;
}): { matched: boolean; notes: string } {
  // If no recipient account is configured yet in settings, cannot verify match
  if (!expectedAccount && !expectedPromptPay) {
    return {
      matched: false,
      notes: "ยังไม่ได้ระบุบัญชีผู้รับในระบบทริป กรุณาตรวจสอบสลิปด้วยตนเอง",
    };
  }

  let bankMatches = true;
  if (expectedBank && slipReceivingBank) {
    const bExp = expectedBank.padStart(3, "0");
    const bSlip = slipReceivingBank.padStart(3, "0");
    bankMatches = bExp === bSlip;
  }

  let accountMatches = false;
  let matchedVia = "";

  if (expectedAccount && slipReceiverAccount && matchMaskedAccount(expectedAccount, slipReceiverAccount)) {
    accountMatches = true;
    matchedVia = "เลขบัญชีธนาคาร";
  } else if (
    expectedPromptPay &&
    slipReceiverProxy &&
    matchMaskedAccount(expectedPromptPay, slipReceiverProxy)
  ) {
    accountMatches = true;
    matchedVia = "พร้อมเพย์";
  } else if (expectedAccount && slipReceiverProxy && matchMaskedAccount(expectedAccount, slipReceiverProxy)) {
    accountMatches = true;
    matchedVia = "หมายเลขผู้รับ";
  }

  const nameMatches = expectedName
    ? matchReceiverName(expectedName, slipReceiverName) ||
      matchReceiverName(expectedName, slipReceiverDisplayName)
    : true;

  if (accountMatches && bankMatches) {
    return {
      matched: true,
      notes: `ตรวจสอบตรงกับบัญชีทริปผ่าน ${matchedVia}${nameMatches ? " และชื่อผู้รับตรงกัน" : ""}`,
    };
  }

  if (accountMatches && !bankMatches) {
    return {
      matched: false,
      notes: "เลขบัญชีตรงกันแต่รหัสธนาคารผู้รับไม่ตรงกับที่ระบุไว้",
    };
  }

  return {
    matched: false,
    notes: "เลขบัญชีหรือพร้อมเพย์ผู้รับในสลิปไม่ตรงกับบัญชีกองกลางของทริป",
  };
}

/**
 * Creates a normalized SlipVerificationResult from SlipOK response data
 */
export function parseSlipOkSuccessResponse(
  raw: Record<string, unknown>,
  expectedSettings?: {
    receivingBank?: string;
    receivingAccount?: string;
    promptPayId?: string | null;
    receivingName?: string;
  }
): SlipVerificationResult {
  const data = (raw.data as Record<string, unknown>) || raw;
  const amountThb = typeof data.amount === "number" ? data.amount : Number(data.amount) || 0;
  const amountSatang = bahtToSatang(amountThb);

  const sender = (data.sender as Record<string, unknown>) || {};
  const senderAccount = (sender.account as Record<string, unknown>) || {};
  const senderProxy = (sender.proxy as Record<string, unknown>) || {};

  const receiver = (data.receiver as Record<string, unknown>) || {};
  const receiverAccount = (receiver.account as Record<string, unknown>) || {};
  const receiverProxy = (receiver.proxy as Record<string, unknown>) || {};

  const receivingBank = String(data.receivingBank || "");
  const receiverAccountVal = receiverAccount.value ? String(receiverAccount.value) : null;
  const receiverProxyVal = receiverProxy.value ? String(receiverProxy.value) : null;
  const receiverDisplayName = receiver.displayName ? String(receiver.displayName) : null;
  const receiverName = receiver.name ? String(receiver.name) : null;

  let receiverMatched = true;
  let matchNotes = "สลิปผ่านการตรวจ";

  if (expectedSettings) {
    const matchRes = verifyReceiverAgainstSettings({
      expectedBank: expectedSettings.receivingBank,
      expectedAccount: expectedSettings.receivingAccount,
      expectedPromptPay: expectedSettings.promptPayId,
      expectedName: expectedSettings.receivingName,
      slipReceivingBank: receivingBank,
      slipReceiverAccount: receiverAccountVal,
      slipReceiverProxy: receiverProxyVal,
      slipReceiverDisplayName: receiverDisplayName,
      slipReceiverName: receiverName,
    });
    receiverMatched = matchRes.matched;
    matchNotes = matchRes.notes;
  }

  return {
    success: true,
    transRef: String(data.transRef || ""),
    transDate: String(data.transDate || ""),
    transTime: String(data.transTime || ""),
    transTimestamp: data.transTimestamp ? String(data.transTimestamp) : undefined,
    sendingBank: String(data.sendingBank || ""),
    receivingBank,
    amount: amountThb,
    amountSatang,
    sender: {
      displayName: sender.displayName ? String(sender.displayName) : null,
      name: sender.name ? String(sender.name) : null,
      accountValue: senderAccount.value ? String(senderAccount.value) : null,
      proxyValue: senderProxy.value ? String(senderProxy.value) : null,
      proxyType: senderProxy.type ? String(senderProxy.type) : null,
    },
    receiver: {
      displayName: receiverDisplayName,
      name: receiverName,
      accountValue: receiverAccountVal,
      proxyValue: receiverProxyVal,
      proxyType: receiverProxy.type ? String(receiverProxy.type) : null,
    },
    rawMessage: data.message ? String(data.message) : "✅",
    isDuplicate: false,
    receiverMatched,
    matchNotes,
  };
}

/**
 * Masks a Thai bank account number for UI privacy (e.g. 1528609933 -> xxx-x-xx933)
 */
export function maskAccountNumber(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = raw.trim();
  const digits = cleaned.replace(/[^0-9]/g, "");

  if (digits.length === 10) {
    // Standard 10-digit Thai bank account (e.g. KBank: xxx-x-xx933)
    return `xxx-x-xx${digits.slice(-3)}`;
  }
  if (digits.length === 12) {
    return `xxx-x-xxxx${digits.slice(-4)}`;
  }
  if (digits.length > 4) {
    const keepLast = Math.min(3, Math.floor(digits.length / 3));
    const maskLen = digits.length - keepLast;
    return `${"x".repeat(maskLen)}${digits.slice(-keepLast)}`;
  }
  return cleaned;
}

/**
 * Masks PromptPay phone or Citizen ID for UI privacy (e.g. 0812345678 -> xxx-xxx-5678)
 */
export function maskPromptPay(raw?: string | null): string {
  if (!raw) return "";
  const cleaned = raw.trim();
  const digits = cleaned.replace(/[^0-9]/g, "");

  if (digits.length === 10) {
    // 10-digit mobile number
    return `xxx-xxx-${digits.slice(-4)}`;
  }
  if (digits.length === 13) {
    // 13-digit Citizen ID: x-xxxx-xxxxx-xx-x
    return `x-xxxx-xxxxx-${digits.slice(10, 12)}-${digits.slice(12)}`;
  }
  if (digits.length > 4) {
    return `xxx-xxx-${digits.slice(-4)}`;
  }
  return cleaned;
}
