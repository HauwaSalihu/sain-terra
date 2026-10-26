
import type { Metadata } from "next";
import Providers from "../providers";
import "../app/globals.css";

export const metadata: Metadata = {
  title: "SainTerra",
  description: "Sainterra property management portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
