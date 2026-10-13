# 🐝 HoneyTrip Device Linking — เชื่อมตัวตนข้ามอุปกรณ์

เชื่อมเบราว์เซอร์ใหม่กับ Firebase UID เดิมโดยไม่ใช้ Google, อีเมล หรือรหัสผ่าน ผู้ใช้ทั่วไปยังเข้าแบบ Anonymous ได้เหมือนเดิม ฟีเจอร์นี้ไม่รวมบัญชี ไม่ลบ Firebase Auth users และไม่แก้สมาชิก เจ้าของห้อง โหวต โพสต์ หรือรายการเงิน

## วิธีใช้

1. เครื่องใหม่เปิด HoneyTrip → **เชื่อมต่ออุปกรณ์** → **เชื่อมต่อกับอุปกรณ์เดิม** หน้าต่างแสดง QR, รหัส 6 หลัก และเวลาที่เหลือ 5 นาที
2. เครื่องเดิมเปิดหน้า **เชื่อมต่ออุปกรณ์** ในเบราว์เซอร์ที่ยังมีตัวตนเดิมอยู่ กรอกรหัส หรืออ่านภาพ/ถ่ายภาพ QR การสแกนด้วยกล้องของระบบแล้วเปิดลิงก์ก็ใช้ได้เมื่อเปิดในเบราว์เซอร์เดิม
3. ตรวจชื่อ รหัส และเครื่องที่เปิดคำขอเอง อ่านคำเตือนสิทธิ์ผู้ดูแลและการเงิน ทำเครื่องหมายยืนยัน แล้วกด **อนุญาตอุปกรณ์นี้** อย่ารับรองรหัสที่คนอื่นส่งมา
4. เครื่องใหม่แสดงชื่อและ **รหัสตัวตน 12 ตัว** ให้เปรียบเทียบกับหน้าจอเครื่องเดิมที่เพิ่งกดอนุญาต ต้องยืนยันว่ากดอนุญาตเองและรหัสตัวตนตรงกันก่อนกด **ใช้ตัวตนนี้บนเครื่องนี้** ชื่ออาจซ้ำกันได้ การอนุมัติโดยใครก็ตามที่เห็น QR จะไม่เปลี่ยน session ปลายทางอัตโนมัติ
5. เครื่องใหม่จึงรับ Custom Token ครั้งเดียว เข้าเป็น UID เดิม โหลดโปรไฟล์จาก `users/{uid}` และสมาชิกของห้องเดิม กลับเส้นทางห้องที่เปิดมาโดยไม่ reload ทั้งเว็บ เครื่องเดิมยังใช้งานต่อได้

QR มีแค่ URL และ request ID สุ่ม 192 บิต ไม่มี UID, ID token, refresh token, Custom Token หรือ claim secret รหัส 6 หลักเป็นเพียงตัวค้นหาคำขอ ไม่ใช่รหัสเข้าสู่ระบบ

## โมเดลความปลอดภัย

ทุก endpoint ใช้ POST และตรวจ Firebase ID Token พร้อมการเพิกถอนผ่าน Admin SDK, ปฏิเสธ cross-origin, ตอบ `Cache-Control: no-store, private` และไม่คืน stack trace/error ภายใน

| Endpoint | หลักฐาน/พฤติกรรม |
| --- | --- |
| `/api/device-link/create` | Anonymous UID ที่พิสูจน์ว่าไม่มีการเขียนข้อมูล; คืน secret สุ่ม 256 บิตให้เครื่องนี้เท่านั้น |
| `/api/device-link/lookup` | session เครื่องเดิม + รหัส 6 หลัก/request ID; คืนเฉพาะข้อมูลยืนยันที่ไม่เป็นความลับ |
| `/api/device-link/approve` | UID จาก ID Token เท่านั้น, ต้องต่างจาก UID ปลายทาง, คำขอ pending, มีการอนุญาต/ปฏิเสธโดยชัดเจน |
| `/api/device-link/status` | UID ปลายทางเดิม + secret; ไม่คืน source UID หรือ token |
| `/api/device-link/claim` | UID ปลายทาง + secret hash ที่ตรง + อนุมัติแล้ว + รหัสตัวตนที่ปลายทางยืนยันตรงกับ source UID + ยังไม่หมดอายุ/ใช้แล้ว |
| `/api/device-link/cancel` | UID ปลายทาง + secret; ยกเลิกและปลดล็อกการเขียนของ UID ปลายทาง |

สถานะเปลี่ยนผ่าน Firestore transactions การ claim พร้อมกันสำเร็จได้เพียงหนึ่งคำขอ สร้าง token ในหน่วยความจำก่อน transaction consume เพื่อให้ signer failure ลองใหม่ได้ แต่ส่ง token เฉพาะผู้ชนะ transaction ไม่บันทึก token ใน Firestore, URL, localStorage, sessionStorage หรือ log

รหัสตัวตนเป็น SHA-256 ของ source UID ที่ย่อเป็น 12 hexadecimal characters ใช้เปรียบเทียบทั้งสองหน้าจอ ไม่ใช่ credential และไม่อยู่ใน QR การตรวจรหัสนี้ช่วยป้องกัน account swapping/session fixation จากการอนุมัติคำขอด้วยบัญชีอื่น: server ไม่ออก token หาก expectedIdentityTag ของปลายทางไม่ตรงกับ UID ที่อนุมัติ ต้องเปรียบเทียบในเบราว์เซอร์เดิมจริงและไม่รับรองรหัสที่บุคคลอื่นบอกมา

หาก response ของ claim สูญหาย **หลัง** consume หรือ Firebase sign-in ล้มเหลว คำขอเดิมจะไม่ออก token ซ้ำ ให้ปิดและเริ่ม pairing ใหม่ อาจต้องรอหมดอายุ 5 นาทีเพื่อให้ปลดล็อก เครื่องเดิมและข้อมูลทั้งหมดไม่ถูกแก้ไข

claim secret เก็บเฉพาะในหน่วยความจำและ **sessionStorage ของ tab ปลายทาง** เพื่อกลับมาหลัง refresh ภายใน 5 นาที เมื่อเชื่อมสำเร็จ/หมดอายุ/ปิดจะล้าง secret การปิด tab หรือ browser ที่ปิด sessionStorage อาจต้องสร้างรหัสใหม่ ไม่เก็บ Firebase tokens เพิ่มจากกลไก persistence ของ Firebase SDK

## ป้องกันการแทนที่ UID ที่มีข้อมูล

คำเตือนใน UI อย่างเดียวไม่พอ จึงเพิ่ม `identityGuards/{uid}`:

- ก่อนเขียนข้อมูลห้องใด ๆ client ต้องตั้ง `used: true` ผ่าน transaction ก่อน Rules ของ **ทุก room mutation** ต้องอ่าน marker นี้ (คงการตรวจเจ้าของ สมาชิก archive และ ledger เดิมทั้งหมด)
- Client ตั้ง `used` กลับ false, ลบ marker หรือปลดล็อกระหว่าง pairing ไม่ได้
- Create pairing transaction ยอมรับเฉพาะ `used != true` และตั้ง lock 5 นาที โดยไม่มีการไล่ค้นหาทุกห้อง
- Create และ first room write แข่งกันได้เพียงหนึ่งทาง: ถ้าเขียน marker ก่อน pairing ถูกปฏิเสธ; ถ้า pairing ล็อกก่อน marker/room write ถูก Rules ปฏิเสธ
- UID ที่สร้างก่อน `DEVICE_LINK_CLEAN_SINCE` ถูกปฏิเสธเป็นปลายทางเสมอ เพราะข้อมูล legacy ไม่มี marker อย่าตีความว่า marker หายแปลว่าไม่มีข้อมูล ใช้เบราว์เซอร์ใหม่ ไม่ต้อง sign out หรือล้างเครื่องที่มีข้อมูลเดิม
- ตรวจตัวตนต้นทางตั้งแต่ lookup และตรวจซ้ำตอน approve: session ใหม่ที่ยังไม่เคยเขียนข้อมูลหรือกำลัง pairing จะถูกปฏิเสธ แม้ localStorage มีชื่อเก่าหลงเหลืออยู่ ผู้ดูแลห้องที่ยังไม่เคยตั้งชื่ออนุญาตได้เมื่อ server ยืนยันตัวตนที่ใช้งานแล้ว และผู้ใช้ยืนยันอย่างชัดเจน
- เครื่องต้นทางเก่ายังอนุญาตได้ตามปกติ หาก shared profile และชื่อใน cache หาย แต่รู้เส้นทางห้อง จะอ่าน member ของ UID ในห้องนั้นหนึ่งเอกสารเพื่อคืนชื่อ/emoji ผู้ใช้ที่ยังไม่มี shared profile จะส่งเฉพาะชื่อ/emoji/recent rooms จากเครื่องต้นทางเมื่ออนุญาต

เพิ่ม marker ใหม่ ไม่ backfill สมาชิก ไม่เปลี่ยน ID ของเอกสารเก่า ห้ามลบ marker หรือย้อนหลัง cutoff เพื่อแก้ปัญหาการเชื่อมต่อ

## ตั้งค่า Firebase/Vercel ก่อนเปิดใช้จริง

1. คง Firebase **Spark** และ Vercel Hobby เปิด Authentication → Sign-in method → **Anonymous** ตามเดิม ไม่ต้องเปิด provider ใหม่ ไม่ต้อง Blaze, Cloud Functions, Storage, SMS หรือฐานข้อมูลเสริม
2. เตรียม release นี้โดยยังเว้น `DEVICE_LINK_CLEAN_SINCE` ว่าง การ linking จะ fail closed ต้องเผยแพร่ client และ Rules เป็น release เดียวกัน: client ใหม่ต้องมี guard rules เพื่อเขียน marker; Rules ใหม่ต้องใช้ client ใหม่ที่เขียน marker แล้ว ช่วงสลับเวอร์ชันให้ refresh client ก่อนแก้ไขข้อมูล guest ยังใช้ Anonymous UID เดิม ไม่ต้อง migrate สมาชิก
3. ขออนุมัติเจ้าของก่อนเผยแพร่ `firestore.rules` บน production Rules ใหม่ปิด `deviceLinkRequests`, `deviceLinkCodes`, `deviceLinkLimits` ต่อ browser SDK; `users/{uid}` อ่าน/เขียนได้เฉพาะ UID ตัวเอง; `identityGuards` ตั้ง used ได้ครั้งเดียว และ room writes ต้องมี marker
4. ตรวจ Rules ที่เผยแพร่แล้วด้วย test account/ห้องทดสอบ: write โดยไม่มี marker ต้องถูกปฏิเสธ, ตั้ง marker แล้วเขียนได้, marker false/locked เขียนไม่ได้ **ห้ามใช้รายการเงิน production ทดสอบ**
5. ตั้ง cutoff เป็น Unix milliseconds **หลัง Rules ใหม่มีผลแน่นอน** เช่นกำหนดเวลาในอนาคต 10 นาที แล้วรอให้ถึงเวลา ห้ามใช้วันสร้าง repo หรือย้อนหลังไปก่อนเปิด Rules เก็บค่าเดียวกันสำหรับ release ต่อไป ห้ามลดค่า คำขอจาก UID ก่อน cutoff ต้องถูกปฏิเสธแม้ยังไม่เคยกรอกข้อมูล
6. Firebase Console → Project settings → Service accounts → Generate new private key เก็บไฟล์นอก repo ใส่ JSON **ทั้งก้อน** ใน server-only `FIREBASE_SERVICE_ACCOUNT_JSON` ของ Vercel Production (ตั้ง Preview เฉพาะโปรเจกต์ทดสอบที่แยกข้อมูล) JSON ต้องมี `project_id`, `client_email`, `private_key` และ project_id ตรง `NEXT_PUBLIC_FIREBASE_PROJECT_ID` ห้ามเติม prefix `NEXT_PUBLIC_`, commit JSON, ถ่ายภาพหรือพิมพ์ key ใน log การใช้ private key นี้เซ็น token ได้โดยไม่ต้อง remote signing service
7. ใส่ `DEVICE_LINK_CLEAN_SINCE` ค่าในข้อ 5 และคง `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` เดิม Environment Variables อื่นของ Geoapify/SlipOK คงเดิม ห้ามเปิด emulator flags บน Vercel
8. Redeploy หลังเจ้าของอนุมัติ ตรวจ Anonymous และ authorized domain ของเว็บจริงตาม Firebase Console ไม่มี composite indexes หรือ collection-group indexes ใหม่ที่ต้องสร้าง ฟีเจอร์อ่านเอกสารตรง ID เท่านั้น
9. ทดสอบจาก Chrome กับ Safari/Edge สอง browser ที่แยก Firebase session: ต้นทางมีสมาชิกอยู่แล้ว ปลายทางเป็น session ใหม่หลัง cutoff เชื่อมจากหน้าห้อง ดูว่าไม่ต้องกรอกวันว่างซ้ำ ชื่อ/โหวตเดิมปรากฏ ต้นทางยังใช้ได้ และ UID ของทั้งคู่ตรงกันใน Firebase Console โดย **ไม่แก้ UID/owner/ข้อมูลเงินด้วยมือ**

Next.js ใน repository เปิด Cache Components ซึ่งใช้ Node.js และไม่รองรับ route exports `runtime`/`dynamic` แบบเดิม endpoints นี้ใช้ Node.js default และ POST ที่ไม่ cache พร้อม no-store headers โดยไม่มี `use cache` รอบข้อมูลยืนยันตัวตน

หากไม่มี Admin credentials หรือ cutoff ที่ถูกต้อง API จะตอบข้อความไทยทั่วไปและหยุดอย่างปลอดภัย ไม่คืน token ทดแทนหรือยอมรับ UID จาก client

## โปรไฟล์และห้องล่าสุด

`users/{uid}` เก็บชื่อพื้นฐาน emoji และ recent rooms สูงสุด 10 ห้อง ไม่มีข้อมูลการเงิน เครื่องต้นทางส่งเฉพาะห้องที่เคยจำไว้จริง ไม่มีการ enumerate ห้องทั้งหมดเพิ่ม เครื่องปลายทางโหลด snapshot นี้เมื่อเปลี่ยน UID/เปิด browser แล้วรีเซ็ต local profile ที่ขัดกัน สมาชิก `rooms/{roomId}/members/{uid}` ยังเป็นแหล่งข้อมูลชื่อ วันว่าง งบ รถ และโน้ตของห้องนั้น

ข้อมูลล่าสุดเป็น preferences แบบเบา โหลดเมื่อเริ่ม session/เชื่อมต่อ และบันทึกเมื่อมีการแก้ local preferences ไม่ใช่ระบบ presence หรือทะเบียนอุปกรณ์แบบ real-time ห้อง legacy ที่ไม่อยู่ใน local recent rooms ของต้นทางจะไม่ถูกค้นพบอัตโนมัติ ฟังก์ชันลืมห้องยังเป็นความชอบเฉพาะเครื่อง; recent rooms ที่ sync ถูก merge เพื่อไม่ทำห้องอีกเครื่องหาย

## โควต้าและการดูแล

Rate limit เก็บใน Firestore ไม่ใช้ memory ของ Vercel: create 3 ครั้ง/UID/10 นาที, lookup/approve 10 ครั้ง/UID/10 นาที, status/claim/cancel 125 ครั้ง/UID/10 นาที, create ไม่เกิน 25 ครั้ง/โปรเจกต์/วัน, lookup 400 ครั้ง/วัน และ API ที่รับไม่เกิน 3,000 ครั้ง/วัน ตัวนับวันอิง UTC ฝั่งเซิร์ฟเวอร์ การ polling ทุก 7 วินาทีหยุดเมื่อ tab ซ่อนหรือ pairing จบ

เป็น budget เฉพาะ feature ไม่ใช่การรับประกันโควต้า Firestore ทั้งแอป การใช้งาน HoneyTrip ส่วนอื่นและคำขอที่ถูกปฏิเสธยังนับ reads ตามจริง Spark จะหยุดเมื่อเกินโควต้าแทนเก็บเงิน ตรวจ Usage ด้วยตัวเอง ลด limits ใน service หากทริปอื่นใช้ quota มาก

คำขอ/ตัวนับที่หมดอายุไม่เป็น credential ถาวร แต่สะสม storage ได้ ให้เจ้าของทำความสะอาดเฉพาะ collections `deviceLinkRequests`/`deviceLinkCodes` ที่ `expiresAt` เก่าเกิน 1 วัน และ `deviceLinkLimits` ที่ `purgeAfter` ผ่านแล้วผ่าน Admin tool ที่ตรวจขอบเขต ห้ามลบ `identityGuards`, `users`, `rooms` หรือ Firebase Auth users ไม่เปิด TTL อัตโนมัติเพราะต้องการคง Spark

อ้างอิง: [Firebase Custom Tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens), [Firestore free quotas](https://firebase.google.com/docs/firestore/quotas), [Firestore pricing/TTL](https://firebase.google.com/docs/firestore/pricing)

## Mobile / Instagram / อุปกรณ์หาย

ใช้รหัสได้โดยไม่ขอกล้อง Safari/Chrome/Instagram อาจมีคนละ session แม้เป็นโทรศัพท์เครื่องเดียว การเปิดลิงก์จาก Instagram ไป Chrome **ไม่ย้ายตัวตนเดิม** ให้กลับไป Instagram ที่เคยใช้งาน แล้วกรอกรหัสในเว็บ ชื่อที่แสดงต้องเป็นชื่อเดิมก่อนอนุญาต กล้องของระบบ/เลือกภาพเป็นตัวช่วยเท่านั้น

Firebase browser-local persistence รักษา session หลังเปิด browser ใหม่ ไม่ต้องสแกนทุกครั้ง; private browsing/การล้าง storage ยังทำให้ session หายได้ ไม่มีปุ่ม sign-out หรือ selective remote revocation ใน feature นี้ หากเสียทุก browser ที่ยังมี session จะกู้ตัวตนด้วยชื่อหรือรหัสห้องไม่ได้ ฟีเจอร์นี้ไม่ใช่ recovery/merge flow ให้เชื่อม browser สำรองก่อนเสียเครื่องเดิม

สิทธิ์การเงินของ repository ปัจจุบันเป็น collaborative (`isManager = Boolean(uid)` และ Rules เดิมให้ authenticated users ร่วมตรวจเงินได้) การ linking ไม่ได้เพิ่มการจำกัด manager หรือเปลี่ยน SlipOK endpoints เป็นระบบอนุญาตใหม่ คงขอบเขตเดิมและ UID ผู้ทำรายการไว้ การปรับนโยบายการเงินเป็นงานแยกที่ต้องออกแบบเอง

## ทดสอบโดยไม่ใช้ production

```sh
npm run lint
npx tsc --noEmit
npm test
npm run test:emulator
npm run build
```

Emulator tests ใช้ `demo-honeytrip-link` เท่านั้น Auth :19099, Firestore :18080, Hub :14400, Logging :14500 ต้องมี Java 21+ และ Node 22+ ทดสอบ Admin transaction จริง + `signInWithCustomToken` ของ Firebase SDK สอง app/session รวม Rules ที่ปฏิเสธ secret docs/locked writes/การเปลี่ยน owner/การเขียนห้อง archived

สำหรับ UI local: เปิด `firebase emulators:start --only auth,firestore --project demo-honeytrip-link` แล้วรัน dev process ด้วย `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-honeytrip-link`, API key `fake-emulator-key`, auth domain `localhost`, app ID `demo-app`, `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:19099`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:18080` และ cutoff เป็นเวลาหลังเปิด Rules demo อย่าแก้ `.env.local` ของ production เพื่อทดสอบ Admin emulator initialization ทำงานเฉพาะ development + demo project + host ที่กำหนด

Unit tests ใช้ service/HTTP adapter เดียวกับ production และ serializable rollback mock ไม่ใช่ predicates ที่คัดลอกมา ผลตรวจจริงและข้อจำกัดของอุปกรณ์จริงดู `docs/device-link-validation.md`
