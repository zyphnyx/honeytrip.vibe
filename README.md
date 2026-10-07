# 🍯 HoneyTrip

เว็บนัดทริปกับเพื่อน — ไม่ต้อง login · real-time · ฟรี 100% (Vercel + Firebase Spark)

ดีไซน์ฉบับเต็ม: ดูเอกสารออกแบบ (stack, data model, roadmap)

## ฟีเจอร์ (Phase 0–1 / MVP)
- สร้างห้องทริป → แชร์ลิงก์ (รหัสห้องสุ่ม 10 ตัว) เข้า LINE
- กรอกชื่อ, สถานะ (ไปแน่/ลังเล/ไม่ไป), จำนวนวัน (ช่วง), งบ, **วันที่ว่าง**, ต้นทาง/รถ, สไตล์
- Dashboard real-time: ใครไปบ้าง, heatmap วันว่าง + **ช่วงวันที่ลงตัวที่สุด**, งบที่ลงตัว, จำนวนวัน, สไตล์/รถ
- ปุ่มคัดลอกสรุปส่ง LINE

## ตั้งค่า Firebase (ฟรี ไม่ต้องใส่บัตร)
1. [Firebase Console](https://console.firebase.google.com) → Add project (ปิด Analytics ได้)
2. **Build → Firestore Database** → Create database (production mode, region `asia-southeast1`)
3. **Build → Authentication → Sign-in method** → เปิด **Anonymous**
4. **Firestore → Rules** → วางเนื้อหาจาก [`firestore.rules`](./firestore.rules) แล้ว Publish
5. **Project settings → Your apps → Web (`</>`)** → copy config
6. `copy .env.example .env.local` แล้วใส่ค่า 4 ตัว

## รัน
```bash
npm install
npm run dev   # http://localhost:3000
```

## Deploy บน Vercel
1. push ขึ้น GitHub → Import project ใน Vercel
2. ใส่ Environment Variables 4 ตัวเดียวกับ `.env.local`
3. Authentication → Settings → **Authorized domains** → เพิ่มโดเมน `*.vercel.app` ของโปรเจกต์

## ข้อจำกัดที่รู้
- ไม่มี login: เคลียร์ browser / เปลี่ยนเครื่อง = uid ใหม่ (จะเข้าห้องเดิมได้แต่ต้องกรอกข้อมูลใหม่) — ระบบ "claim ตัวตนเดิม" อยู่ใน roadmap
- อย่าเก็บข้อมูลอ่อนไหว (เบอร์/บัญชีธนาคาร) — ใครมีลิงก์ก็เข้าห้องได้

## Roadmap
- Phase 2: แนะนำสถานที่ + โหวต + fit score + link preview
- Phase 3: Lock plan, claim ตัวตน
- Phase 4: หารเงิน, itinerary, checklist, PWA
