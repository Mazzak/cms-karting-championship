import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CMS Karting Championship",
  description: "Homepage e painel de gestão do campeonato CMS Karting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
