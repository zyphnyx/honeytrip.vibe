import { type deviceLinkService, LinkError } from "./deviceLinkService.ts";

export type LinkAction = "create" | "status" | "lookup" | "approve" | "claim" | "cancel";
export interface LinkHttpBackend {
  verify(token: string): Promise<{ uid: string; anonymous: boolean }>;
  service: ReturnType<typeof deviceLinkService>;
}

async function limitedJsonBody(request: Request) {
  if (Number(request.headers.get("content-length")) > 2048) throw new LinkError("คำขอยาวเกินไป", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new LinkError("คำขอไม่ถูกต้อง");
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > 2048) { await reader.cancel(); throw new LinkError("คำขอยาวเกินไป", 413); }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}
export function deviceLinkHttp(action: LinkAction, backend: () => LinkHttpBackend) {
  return async (request: Request) => {
    const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
    try {
      const origin = request.headers.get("origin");
      const url = new URL(request.url);
      // Next dev normalizes request.url to localhost even for the second loopback hostname.
      const requestOrigin = `${url.protocol}//${request.headers.get("host") || url.host}`;
      if (origin && origin !== requestOrigin) throw new LinkError("ไม่อนุญาตคำขอจากเว็บไซต์อื่น", 403);
      if (request.headers.get("sec-fetch-site") === "cross-site") throw new LinkError("ไม่อนุญาตคำขอจากเว็บไซต์อื่น", 403);
      if (!request.headers.get("content-type")?.startsWith("application/json")) throw new LinkError("คำขอไม่ถูกต้อง");
      const bearer = request.headers.get("authorization");
      if (!bearer?.startsWith("Bearer ") || bearer.length > 8192) throw new LinkError("กรุณาเปิด HoneyTrip ในเบราว์เซอร์เดิมอีกครั้ง", 401);
      const { verify, service } = backend();
      let user;
      try { user = await verify(bearer.slice(7)); }
      catch { throw new LinkError("ยืนยันตัวตนไม่สำเร็จ กรุณาเปิด HoneyTrip อีกครั้ง", 401); }
      await service.rateLimit(user.uid, action);
      const text = await limitedJsonBody(request);
      let body;
      try { body = JSON.parse(text); } catch { throw new LinkError("คำขอไม่ถูกต้อง"); }
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new LinkError("คำขอไม่ถูกต้อง");
      let result;
      switch (action) {
        case "create": result = await service.create(user.uid, user.anonymous, typeof body.deviceDescription === "string" ? body.deviceDescription : "Browser"); break;
        case "lookup": if (typeof body.code !== "string") throw new LinkError("กรุณากรอกรหัสเชื่อมต่อ"); result = await service.lookup(user.uid, body.code.replace(/[-\s]/g, "")); break;
        case "status": result = await service.status(user.uid, body.requestId, body.claimSecret); break;
        case "approve": if (typeof body.allow !== "boolean") throw new LinkError("กรุณายืนยันการอนุญาต"); result = await service.approve(user.uid, body.requestId, body.allow); break;
        case "claim":
          if (typeof body.expectedIdentityTag !== "string" || !/^[a-f0-9]{12}$/.test(body.expectedIdentityTag)) throw new LinkError("กรุณาตรวจรหัสตัวตนจากเครื่องเดิมก่อนเชื่อมต่อ");
          result = await service.claim(user.uid, body.requestId, body.claimSecret, body.expectedIdentityTag); break;
        case "cancel": result = await service.cancel(user.uid, body.requestId, body.claimSecret); break;
      }
      return Response.json(result, { headers });
    } catch (e) {
      return Response.json({ error: e instanceof LinkError ? e.message : "ระบบเชื่อมต่อยังไม่พร้อมหรือเครือข่ายขัดข้อง กรุณาลองใหม่ภายหลัง" }, { status: e instanceof LinkError ? e.status : 503, headers });
    }
  };
}
