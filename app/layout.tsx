import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "保研深挖 · 科研经历模拟面试",
  description:
    "像真实导师一样追问你的科研经历，五维度深挖 + 可执行反馈，专为保研复试设计。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        {children}
      </body>
    </html>
  );
}
