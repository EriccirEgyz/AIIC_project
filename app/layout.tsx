import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 保研深挖 · 顶会式科研经历追问",
  description:
    "像 AI 顶会审稿人一样追问你的科研经历，按 ablation / baseline / 显著性 / 复现性深挖。专为想保研到人工智能方向的本科生设计。",
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
