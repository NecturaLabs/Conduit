import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

const inter = localFont({
  src: '../public/fonts/inter-variable.woff2',
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Conduit — Dashboard for AI Coding Agents',
  description:
    'Monitor, configure, and control OpenCode & Claude Code from your phone. Self-host for free or use Conduit Cloud.',
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'Conduit — Dashboard for AI Coding Agents',
    description:
      'Monitor, configure, and control OpenCode & Claude Code from your phone. Self-host for free or use Conduit Cloud.',
    siteName: 'Conduit',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="midnight" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-base text-text antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-base focus:font-semibold focus:outline-none"
        >
          Skip to main content
        </a>
        <Navbar />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
