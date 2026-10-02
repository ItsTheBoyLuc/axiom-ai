import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ComparisonTray } from '@/components/comparison/comparison-tray';
import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';
import { PaletteProvider } from '@/components/layout/command-palette';
import { SmoothScroll } from '@/components/layout/smooth-scroll';
import { ThemeProvider, themeInitScript } from '@/components/layout/theme-provider';
import '../styles/globals.css';

/** Static pages re-check the database (footer timestamp) at most every 5 minutes. */
export const revalidate = 300;

const siteUrl = process.env.APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'AXIOM AI - The Intelligence Standard', template: '%s | AXIOM AI' },
  description:
    "Discover, compare, and understand the world's most advanced AI models in one place.",
  openGraph: { siteName: 'AXIOM AI', type: 'website' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#08090C' },
    { media: '(prefers-color-scheme: light)', color: '#F7F8FA' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        {/* Applies the saved theme before first paint: no flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <PaletteProvider>
            <a
              href="#main"
              className="sr-only-focusable bg-accent text-accent-fg fixed top-3 left-3 z-[100] rounded-lg px-4 py-2 text-sm font-medium"
            >
              Skip to content
            </a>
            <SmoothScroll />
            <Navbar />
            <main id="main">{children}</main>
            <Footer />
            <ComparisonTray />
          </PaletteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
