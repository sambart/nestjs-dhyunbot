import "./globals.css";

import type { Metadata } from "next";
import { Geist,Inter } from "next/font/google";

import { cn } from "@/lib/utils";

import Footer from "./components/Footer";
import Header from "./components/Header";
import { SidebarProvider } from "./components/SidebarContext";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Discord Bot Dashboard",
  description: "디스코드 서버를 더 스마트하게 관리하세요",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={cn("font-sans", geist.variable)}>
      <body className={inter.className}>
        <SidebarProvider>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </SidebarProvider>
      </body>
    </html>
  );
}
