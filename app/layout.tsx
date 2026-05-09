import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "English Tutor — Hands-free",
  description: "Luyện nói tiếng Anh rảnh tay với AI (Groq + Web Speech API).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
