import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: "Swipewise: swipe the right card, every time", template: "%s · Swipewise" },
  description:
    "Swipewise tells you which credit card to use for every purchase, which cards are worth their fee, and which card you're missing.",
};

export const viewport: Viewport = { themeColor: "#07070a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{ style: { background: "#15151c", border: "1px solid rgba(255,255,255,0.1)", color: "#f4f4f5" } }}
        />
      </body>
    </html>
  );
}
