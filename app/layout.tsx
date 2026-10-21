import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GGLADMIN | Gorakhpur's Got Latent",
  description: "Secure administration dashboard for Gorakhpur's Got Latent.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
