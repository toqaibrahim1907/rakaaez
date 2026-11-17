import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "الركائز | إدارة التأجير",
  description: "إدارة العاملات والعقود والرواتب",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
