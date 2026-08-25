import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FocusMatrix — 코비 4사분면 Task 관리",
  description:
    "중요도와 기한을 입력하면 Task가 자동으로 4사분면(Q1~Q4)에 배치되는 스마트 Task 매니저",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
