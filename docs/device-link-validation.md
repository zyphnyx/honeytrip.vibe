# ผลตรวจ HoneyTrip Device Linking

ตรวจวันที่ 13 ตุลาคม 2026 (Asia/Bangkok) บน branch `main` ฐาน commit `a983082` working tree เริ่มต้นสะอาด ไม่มีการ push, merge, deploy หรือเปลี่ยน production Firebase settings และไม่มีการใช้รายการเงิน production ทดสอบ

## คำสั่งที่รันจริง

| คำสั่ง | ผล |
| --- | --- |
| `npm run lint` | ผ่าน ไม่มี error/warning ของ source |
| `npx tsc --noEmit` | ผ่าน |
| `npm test` | 97 tests ผ่านทั้งหมด รวม device linking 16 cases และ regression suites เดิม |
| `npm run test:emulator` | 2 integration tests ผ่าน Auth + Firestore demo emulators และ Rules จริง |
| `npm run build` | ผ่าน Next.js 16.4.0, endpoints เป็น dynamic POST และ `/device-link` สร้าง static shell ได้ |
| `npm audit --omit=dev` | 0 vulnerabilities หลังใช้ patched gRPC override |
| `git diff --check` | ผ่าน |

Warnings ของ Node experimental type stripping/module detection ยังเป็นคำเตือนของ test runner เดิม Build มี warning ว่าไม่ใช้ `package-lock.json` ที่อยู่นอก repository ใน home directory; build สำเร็จโดยไม่แก้ไฟล์นอก workspace Emulator logs ที่มี PERMISSION_DENIED เป็น negative assertions ที่คาดไว้ ไม่ใช่ tests ล้มเหลว

## ขอบเขตหลักฐาน

Unit tests เรียก service และ HTTP adapter ที่ production ใช้จริง ผ่าน serializable mock ที่ rollback transactions ได้ ตรวจ invalid request/code, self approval, session ใหม่ที่ไม่มีข้อมูล, ไม่ผ่าน ID Token, UID ที่พยายามปลอมใน body, secret หาย/ผิด, UID ปลายทางผิด, หมดอายุที่ 5 นาที, cancel/deny, duplicate/replay, concurrent claims, signer failure, backend/missing credentials, malformed/oversized body, cross-origin, claim ที่รหัสตัวตนหาย/ไม่ตรงต้องไม่ mint token และ durable limits รวม budget โปรเจกต์ที่เปลี่ยน anonymous UID ก็หลบไม่ได้ ผู้ดูแลที่ยังไม่ตั้งชื่อก็เชื่อมตัวตนที่เคยใช้งานแล้วได้

Emulator integration ใช้ `demo-honeytrip-link` เท่านั้น สร้างสอง Firebase app/session แบบ Anonymous, ออก Custom Token ด้วย Admin SDK แล้วเรียก `signInWithCustomToken` ของ Firebase client SDK จริง ยืนยัน exact UID, source ยัง sign in, target อ่าน member/profile เดิม, records สมาชิก/owner/vote/post/comment/payment/ledger ไม่เปลี่ยนก่อนทดสอบ archive/restore และ temporary Auth account ยังอยู่ Rule integration ทดสอบ secret docs ปิดทั้งหมด, guard locked/used immutable, archived read-only, owner archive/restore, vote ตาม UID และ users private

## Browser UI ที่ทดสอบจริง

ใช้ Chromium ของ Codex In-app Browser กับ dev server port 3108 และ Firebase demo emulators แยก local origin `localhost`, `127.0.0.1`, `link-test.localhost` เพื่อแยก Firebase persistence โดยไม่ใช้งานบัญชีจริง

- Guest สร้างทริปและบันทึกชื่อ **เจมทดสอบ** พร้อมวันว่างได้
- เครื่องใหม่สร้าง modal QR + short code + countdown/progress ได้
- Refresh เครื่องใหม่คืนคำขอเดิมและเวลาคงเหลือจริง ไม่เริ่มเวลา 5 นาทีใหม่
- เครื่องเดิมกรอกรหัส ตรวจชื่อ/คำเตือน และต้อง checkbox + กดอนุญาตเอง
- หลัง source อนุญาต ปลายทางยังไม่เปลี่ยน UID จนเปรียบเทียบรหัสตัวตนที่ตรงกับ source แล้ว checkbox + กดใช้ตัวตนเอง ป้องกันการสลับเข้าบัญชีของผู้อนุมัติที่ไม่รู้จัก
- เครื่องใหม่ sign in แล้วกลับไปเส้นทางห้องที่เปิดมา เห็นชื่อและวันว่างเดิม สมาชิกยังมีหนึ่งคน ไม่มีการสร้างสมาชิกซ้ำ
- Refresh หลัง linking ยังเป็นสมาชิกเดิม ต้นทางยังใช้งานต่อได้
- QR approval URL เปิด confirmation โดยไม่อนุญาตอัตโนมัติ; hash navigation ในหน้าที่เปิดอยู่แล้วทำงาน และ invalid request แสดง error ไทย
- ปฏิเสธคำขอแล้วปลายทางแสดง denied; ปลายทางสร้างคำขอใหม่และยกเลิกได้
- เครื่องที่มีโปรไฟล์ถูกเตือนและไม่ถูกแทนที่
- ตรวจ desktop และ viewport 390×844: profile/name เดิม, manual entry, QR modal, ไม่มี horizontal overflow (`documentWidth <= viewportWidth`)
- ตรวจ runtime log หลังแก้ session boundary แล้ว reload: ไม่พบ error/warning ใหม่
- บันทึกภาพสมาชิกเดิมบนปลายทางเป็น artifacts `device-linked.jpg` และ `device-confirmation.jpg` ในโฟลเดอร์ visualizations ของ chat (ไม่ใช่ production screenshot)

แก้ปัญหาที่พบระหว่างตรวจ: sandbox บล็อก SWC Windows path (รัน build นอก sandbox), port 8080 ถูกใช้ (เปลี่ยน demo ports), route exports แบบเดิมไม่เข้ากับ Cache Components (ใช้ Node default/non-cached POST ตาม bundled docs), origin ของ dev URL ถูก normalize (ตรวจ request Host), การซ่อน route ด้วยการไม่ render ทำให้ instant-navigation validation เตือน (render segment แต่ทำ inputs inert จน session พร้อม)

## สิ่งที่ยังไม่ได้ยืนยันบนอุปกรณ์/บริการจริง

- ยังไม่ได้ทดสอบ iPhone Safari, Android Chrome หรือ Instagram app จริง ใช้ responsive Chromium และ manual-code fallback ตรวจ UX แล้ว เจ้าของควรทดสอบเครื่องจริงก่อน rollout
- ยังไม่ได้ใช้ production Admin credentials หรือ Vercel runtime เพื่อออก token `.env.local` ไม่มี `FIREBASE_SERVICE_ACCOUNT_JSON` และ `DEVICE_LINK_CLEAN_SINCE` จึง fail closed; ตรวจว่ามี Vercel project link ในเครื่อง แต่ไม่ได้อ่าน/เปลี่ยน remote Environment Variables
- ยังไม่ได้เรียก SlipOK live หรือทดสอบอนุมัติ/โอนเงินจริง Regression ที่รันเป็น calculation, parser, mock state, rules และข้อมูลการเงิน demo เท่านั้น
- ไม่มี selective remote revocation, account merging หรือ recovery เมื่อไม่มี browser เดิมที่ยังมี session
- Runtime audit ผ่าน; ไม่ได้อ้างว่า dev dependency audit ทั้ง tree ไม่มี advisories

## ไฟล์ที่สร้าง

- `app/api/device-link/{create,status,lookup,approve,claim,cancel}/route.ts`
- `app/device-link/page.tsx`
- `components/DeviceLinkEntry.tsx`, `components/IdentitySession.tsx`
- `lib/firebaseAdmin.ts`, `lib/deviceLinkService.ts`, `lib/deviceLinkHttp.ts`, `lib/deviceLinkHandler.ts`, `lib/deviceLinkClient.ts`, `lib/sharedProfile.ts`
- `tests/device-link.test.mjs`, `tests/device-link.rules.test.mjs`, `tests/device-link.emulator.test.mjs`
- `firebase.json`, `docs/device-linking.md`, `docs/device-link-validation.md`

## ไฟล์ที่แก้

- `lib/firebase.ts`, `lib/rooms.ts`, `lib/places.ts`, `lib/activities.ts`, `lib/finance.ts`: session foundation + write usage guard
- `store/profile.ts`: ผูก cached preferences กับ UID
- `app/layout.tsx`, `app/page.tsx`, `app/t/[roomId]/page.tsx`: session boundary + secondary linking entry
- `firestore.rules`: deny pairing docs, private users, immutable identity usage guard และคง authorization เดิม
- `.env.example`, `README.md`: setup/security guide
- `next.config.ts`: loopback dev origin สำหรับสอง session ทดสอบ
- `package.json`, `package-lock.json`: Admin/QR libraries, test tooling/scripts และ patched gRPC override
- `.gitignore`: ไม่เก็บ emulator debug logs ใน git

ขั้นตอนเปิดใช้จริงและลำดับเผยแพร่ client/Rules/cutoff อยู่ใน [คู่มือเจ้าของ](./device-linking.md) ต้องขออนุมัติก่อน deploy หรือ publish Rules production
