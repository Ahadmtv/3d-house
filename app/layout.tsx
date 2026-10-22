import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fieldhouse — A home for good ideas",
  description:
    "Step inside Fieldhouse, an independent creative studio shaping thoughtful spaces and digital experiences.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
