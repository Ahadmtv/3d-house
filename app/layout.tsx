import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";
import "./polish.css";

const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Fieldhouse — A home for good ideas",
  description:
    "Step inside Fieldhouse, an independent creative studio shaping thoughtful spaces and digital experiences. Scroll through a house built for good ideas.",
  openGraph: {
    title: "Fieldhouse — A home for good ideas",
    description: "An independent creative studio, told as a walk through a house.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#dcd7bf" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
