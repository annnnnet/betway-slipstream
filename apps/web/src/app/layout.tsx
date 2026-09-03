import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { TopBar } from '@/components/nav/TopBar';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Slipstream — Betway booking codes, decoded',
  description:
    'Paste a Betway Nigeria booking code to see every leg, market and price. Build a new slip, ' +
    'convert an existing one, and verify the result on Betway itself.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>
          <TopBar />
          <main className="flex-1">{children}</main>
          <footer className="border-t py-6 text-center text-xs text-muted-foreground">
            Slipstream is an independent tool. Not affiliated with or endorsed by Betway.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
