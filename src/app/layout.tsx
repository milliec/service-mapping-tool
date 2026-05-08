import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const roboto = localFont({
  src: [
    { path: '../../public/fonts/roboto-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/roboto-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/roboto-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-roboto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Service Blueprint',
  description: 'Visual service blueprint mapping tool for service designers and cross-functional teams',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={roboto.variable} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <a
          href="#board-main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-neutral-900 focus:shadow-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
        >
          Skip to board
        </a>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
