import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TIDDI",
  description: "용량 경고가 뜰 때 10분 안에 끝내는 저장공간 정리",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
