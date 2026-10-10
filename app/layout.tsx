import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { StoreHydrator } from "@/components/StoreHydrator";
import { AnimatedBackground } from "@/components/background/AnimatedBackground";

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
    <html lang="th" className={`${notoThai.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=localStorage.getItem('honeytrip_motion_enabled');var r=window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(m==='false'||(m===null&&r)){document.documentElement.classList.add('h-paused');document.body&&document.body.classList.add('h-paused');}}catch(e){}})();`,
          }}
        />
        <StoreHydrator />
        <AnimatedBackground>
          {children}
        </AnimatedBackground>
      </body>
    </html>
  );
}
