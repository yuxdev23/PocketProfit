# Deploy PocketProfit ขึ้น Railway (ฉบับมือใหม่)

PocketProfit เก็บ **ฐานข้อมูล (SQLite) + รูปใบเสร็จ** ลงดิสก์ จึงต้องมี **Volume (ดิสก์ถาวร)**
ไฟล์ที่จำเป็น (`Dockerfile`, `docker-entrypoint.sh`, `railway.json`) เตรียมไว้ให้แล้ว —
คุณแค่ตั้งค่าใน Railway ตามนี้

## ต้องมี
- บัญชี **GitHub** (โค้ดอยู่บน GitHub แล้ว)
- บัญชี **Railway** → https://railway.app (กด *Login with GitHub*)

## ขั้นตอน (คลิกใน dashboard)
1. **New Project → Deploy from GitHub repo** → เลือก repo `pocketprofit`
   Railway จะเจอ `Dockerfile` แล้ว build ให้เอง
2. แท็บ **Variables** → Add:
   - `DATABASE_URL` = `file:/data/prod.db`
   - *(ถ้าจะเปิดผู้ช่วย AI)* `ANTHROPIC_API_KEY` = `sk-ant-...`
3. แท็บ **Settings → Volumes → Add Volume** → **Mount path = `/data`**
   (เก็บทั้ง database และรูปใบเสร็จไว้ที่นี่ → ไม่หายเวลารีสตาร์ท/redeploy)
4. Railway จะ **redeploy** ให้อัตโนมัติ — ตอนบูตจะรัน `prisma migrate deploy` สร้าง DB ให้เอง
5. แท็บ **Settings → Networking → Generate Domain** → ได้ **URL จริง + HTTPS**
6. เปิด URL → **สมัครบัญชีแรก** (ฐานข้อมูลเริ่มว่าง) → ใช้งานได้เลย

## หมายเหตุ
- ฐานข้อมูลเริ่มต้น **ว่าง** (ไม่มีข้อมูลตัวอย่าง) — สมัคร/ล็อกอินแล้วเริ่มบันทึกได้ทันที
- อยากได้ข้อมูลเดโม (พี่นภา) บนเครื่อง prod → บอกทีมได้ จะเพิ่มขั้นตอน seed ให้
- **อัปเดตแอป:** push โค้ดใหม่ขึ้น GitHub → Railway redeploy อัตโนมัติ
- ค่าใช้จ่าย: ~$5/เดือน (มีเครดิตทดลองให้ก่อน) เพราะ SQLite ต้องใช้ดิสก์ถาวร
