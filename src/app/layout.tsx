import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";
import { getSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/default-settings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadata dinamis: judul, deskripsi, dan favicon mengikuti pengaturan admin
export async function generateMetadata(): Promise<Metadata> {
  let settings = DEFAULT_SETTINGS;
  try {
    settings = await getSettings();
  } catch {
    // database belum siap → pakai nilai bawaan
  }

  return {
    title: settings.appTitle,
    description: settings.appDescription,
    keywords: [
      "Dashboard Keuangan",
      "APBD",
      "Kabupaten Seruyan",
      "PEMDA",
      "Anggaran Daerah",
    ],
    ...(settings.faviconUrl ? { icons: { icon: settings.faviconUrl } } : {}),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      {/* suppressHydrationWarning: ekstensi browser (mis. Grammarly) menambah
          atribut data-* pada <body> sebelum React hidrasi */}
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
