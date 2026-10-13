import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AirScope — моніторинг якості повітря",
  description: "Аналітична панель станцій моніторингу якості повітря з інтеграцією Power BI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
