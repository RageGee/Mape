import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cinzel, EB_Garamond } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" });
const garamond = EB_Garamond({ subsets: ["latin"], variable: "--font-garamond" });

export const metadata: Metadata = {
  title: "Cartographica — Medieval World & City Generator",
  description: "Procedural medieval worlds: terrain, kingdoms, trade roads and living cities, generated from a seed and explored down to individual streets and buildings.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${cinzel.variable} ${garamond.variable} bg-[#0d0a07] text-[#d8c9a3] antialiased`}>
        {children}
      </body>
    </html>
  );
}
