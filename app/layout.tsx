import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZAKALKA — forge your strength",
  description: "Your personal forge for calisthenics training, nutrition, and progress.",
  applicationName: "ZAKALKA",
  icons: { icon: "/images/zakalka-mark.png", shortcut: "/images/zakalka-mark.png", apple: "/images/zakalka-mark.png" },
};
export const viewport: Viewport = { themeColor: "#111210", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
