
import type { Metadata } from "next";
import Providers from "../providers";
import "../app/globals.css";

export const metadata: Metadata = {
  title: "Sain Terra",
  description: "Sain Terra internal real estate portal",
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
