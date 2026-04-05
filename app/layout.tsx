import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "User Test Recorder",
  description: "Recorder integration harness for a Unity web game."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
