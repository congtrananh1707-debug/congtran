import "./globals.css";
import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";

// next/font tự host & tối ưu font; expose qua CSS vars (var(--font-inter),
// var(--font-lexend)) để Tailwind theme tham chiếu tới được.
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
});

const lexend = Lexend({
  subsets: ["latin", "vietnamese"],
  variable: "--font-lexend",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kong — AI English Tutor",
  description:
    "Trò chuyện luyện nói tiếng Anh với Kong — gia sư AI thân thiện.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${lexend.variable}`}>
      <body className="font-sans antialiased">
        {/* Animated gradient mesh — sits behind everything (z-index: -1
            trong globals.css). Pure CSS, drift 24s. */}
        <div aria-hidden className="bg-mesh" />
        {children}
      </body>
    </html>
  );
}
