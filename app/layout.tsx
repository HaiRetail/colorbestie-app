import "./globals.css";
import type { Metadata, Viewport } from "next";
import { CapacitorBootstrap } from "@/components/app/capacitor-bootstrap";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "ColorBestie",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CapacitorBootstrap />
        {children}
      </body>
    </html>
  );
}
