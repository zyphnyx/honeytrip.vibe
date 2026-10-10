# 🍯 HoneyTrip

เว็บนัดทริปกับเพื่อน — ไม่ต้อง login · real-time · ฟรี 100% (Vercel + Firebase Spark)

ดีไซน์ฉบับเต็ม: ดูเอกสารออกแบบ (stack, data model, roadmap)

## ฟีเจอร์หลัก
- **นัดวันและงบ (Phase 1 / MVP):**
  - สร้างห้องทริป → แชร์ลิงก์ (รหัสห้องสุ่ม 10 ตัว) เข้า LINE
  - กรอกชื่อ, สถานะ (ไปแน่/ลังเล/ไม่ไป), จำนวนวัน, งบ, **วันที่ว่าง**, ต้นทาง/รถ, สไตล์
  - Dashboard real-time: heatmap วันว่าง + **ช่วงวันที่ลงตัวที่สุด**, งบที่ลงตัว, จำนวนวัน, สไตล์/รถ
  - คัดลอกสรุปส่ง LINE พร้อมผลโหวตสถานที่
- **ค้นหาและโหวตสถานที่ (Phase 2 - Place Discovery & Voting):**
  - **🏡 ที่พัก (Accommodation):** เสนอได้ไม่จำกัด, โหวตได้ 1 ที่ต่อคน (สลับ/ถอนโหวตได้), แสดงราคา/คืน, ความจุคน, ทำเล, ลิงก์จอง
  - **📍 ที่เที่ยว (Attractions):** เสนอได้ไม่จำกัด, โหวตได้สูงสุด 3 ที่ต่อคน (สลับ/ถอนโหวตได้), แสดงค่าเข้า, เวลาที่ใช้เที่ยว, ลิงก์แผนที่
  - **🗺️ จุดหมายปลายทางทริป (Destination):** ระบุและแก้ไขปลายทางของทริปได้ชัดเจน (แยกจากต้นทางของผู้ร่วมทริป)
  - **🧭 Discovery ฟรี 100%:** ค้นหาสถานที่อัตโนมัติรอบปลายทางผ่าน Geoapify Free Plan + OpenStreetMap (Attribution ครบถ้วน) พร้อมปุ่ม fallback เปิดค้นหาบน Google Maps
  - **💡 เสนอด้วยตนเอง:** เสนอสถานที่พร้อมแนบลิงก์ภายนอกได้โดยไม่ต้องพึ่งพา API ใดๆ
  - **⚖️ ระบบโหวตโปร่งใส:** นับคะแนนเฉพาะผู้มีสิทธิ์ (สถานะไปแน่/ลังเล), ตรวจสอบคะแนนเสมอกัน (Tie-breaking), แสดงรายชื่อเพื่อนที่โหวตแบบ Real-time

## ตั้งค่า Firebase (ฟรี 100% ไม่ต้องใส่บัตร)
1. [Firebase Console](https://console.firebase.google.com) → Add project (ปิด Analytics ได้)
2. **Build → Firestore Database** → Create database (production mode, region `asia-southeast1`)
3. **Build → Authentication → Sign-in method** → เปิด **Anonymous**
4. **Firestore → Rules** → วางเนื้อหาจาก [`firestore.rules`](./firestore.rules) แล้ว Publish (รองรับ `rooms`, `members`, `places`, `votes`, `settings`)
5. **Project settings → Your apps → Web (`</>`)** → copy config
6. `copy .env.example .env.local` แล้วใส่ค่า

## ตั้งค่า Geoapify Discovery (ทางเลือกเสริม - ฟรี 100%)
1. สมัครบัญชีฟรีที่ [Geoapify Console](https://myprojects.geoapify.com/) (ไม่ต้องผูกบัตรเครดิต ได้โควต้าฟรี 3,000 credits/วัน)
2. นำ API Key มาใส่ใน `GEOAPIFY_API_KEY` ใน `.env.local`
3. *หมายเหตุ:* หากไม่ได้ใส่คีย์นี้ ระบบจะปิดการค้นหาอัตโนมัติอย่างนุ่มนวล โดยผู้ใช้ยังสามารถเสนอสถานที่ด้วยตนเองและร่วมโหวตได้ตามปกติ 100%

## รันและทดสอบ
```bash
npm install
npm test       # รัน Unit tests ของระบบโหวต
npm run dev    # http://localhost:3000
```

## Deploy บน Vercel
1. push ขึ้น GitHub → Import project ใน Vercel
2. ใส่ Environment Variables จาก `.env.local` (ตัวแปร Firebase 4 ตัว และ `GEOAPIFY_API_KEY`)
3. Authentication → Settings → **Authorized domains** → เพิ่มโดเมน `*.vercel.app` ของโปรเจกต์

## ข้อจำกัดที่รู้
- ไม่มี login: เคลียร์ browser / เปลี่ยนเครื่อง = uid ใหม่ (จะเข้าห้องเดิมได้แต่ต้องกรอกข้อมูลใหม่)
- อย่าเก็บข้อมูลอ่อนไหว (เบอร์/บัญชีธนาคาร) — ใครมีลิงก์ก็เข้าห้องได้

## Roadmap
- Phase 3: Lock plan, claim ตัวตน
- Phase 4: หารเงิน, itinerary, checklist, PWA

