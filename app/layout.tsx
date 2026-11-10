import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Bebas_Neue, Barlow_Condensed, Anton, Outfit, Inter } from 'next/font/google';
import AdminSession from '@/components/AdminSession';
import './globals.css';
const bebas = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
});

const barlow = Barlow_Condensed({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-barlow',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const verification = (await headers()).get('x-ggl-surface') === 'ticket-verification';
  return { title: verification ? 'GGL | Ticket Verification' : 'GGLADMIN | Admin Portal', description: verification ? 'Authorized GGL ticket verification' : 'Private GGL administration portal', robots: { index: false, follow: false } };
}
export default async function RootLayout({children}: {children: React.ReactNode}) {
  const verification = (await headers()).get('x-ggl-surface') === 'ticket-verification';
  return <html lang="en" className={`${bebas.variable} ${barlow.variable} ${anton.variable} ${outfit.variable} ${inter.variable} scroll-smooth`}><body className="ggl-site bg-[#07080e] text-slate-100 antialiased selection:bg-amber-500 selection:text-black min-h-screen">{verification ? children : <AdminSession>{children}</AdminSession>}</body></html>;
}
