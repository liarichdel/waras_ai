import type { Metadata, Viewport } from "next";
import { Pixelify_Sans } from "next/font/google";
import "./globals.css";

// Pixelify Sans is a variable pixel font (weights 400 to 700), so no `weight` option is needed.
// It matches the pixel mascot, logo and number glyphs, and keeps Indonesian body text readable.
const pixel = Pixelify_Sans({
  variable: "--font-pixel",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WARAS AI",
  description: "Pelatih kebugaran virtual: koreksi squat real-time dengan computer vision",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f3" },
    { media: "(prefers-color-scheme: dark)", color: "#12100e" },
  ],
};

// Runs before first paint: saved choice wins, otherwise follow the OS. Avoids a light/dark flash.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      data-theme="dark"
      suppressHydrationWarning
      className={`${pixel.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
