import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { StoreHydrator } from "@/components/StoreHydrator";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "HoneyTrip 🍯 นัดทริปกับเพื่อน",
  description: "นัดไป outing กับเพื่อน — กรอกวันว่าง งบ แนะนำที่เที่ยว ดู dashboard แบบ real-time",
};

export const viewport: Viewport = {
  themeColor: "#fbbf24",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${notoThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <StoreHydrator />
        {children}
      </body>
    </html>
  );
}
