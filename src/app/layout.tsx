import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ComparisonTray } from '@/components/comparison/comparison-tray';
import { CspNonce } from '@/components/layout/csp-nonce';
import { Footer } from '@/components/layout/footer';
import { Navbar } from '@/components/layout/navbar';
import { PaletteProvider } from '@/components/layout/command-palette';
import { MotionPreferenceProvider } from '@/components/layout/motion-preference-provider';
import { MotionProvider } from '@/components/layout/motion-provider';
import { SessionProvider } from '@/components/account/session-provider';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { themeInitScript } from '@/lib/theme-script';
import { motionInitScript } from '@/lib/motion-preference';
import '../styles/globals.css';

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

/**
 * Every page is rendered per request: the Content-Security-Policy carries a fresh nonce (set in
 * src/proxy.ts), which Next.js can only apply while rendering. Reading the request headers here
 * is what opts the whole tree into dynamic rendering. Data reads stay cached in Redis.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        {/* Applies the saved theme and the motion mode before first paint: no flash. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeInitScript + motionInitScript }}
        />
      </head>
      <body className="font-sans antialiased">
        <CspNonce nonce={nonce} />
        <ThemeProvider>
          <MotionPreferenceProvider>
            <SessionProvider>
              <MotionProvider>
                <PaletteProvider>
                  <a
                    href="#main"
                    className="sr-only-focusable bg-accent text-accent-fg fixed top-3 left-3 z-[100] rounded-lg px-4 py-2 text-sm font-medium"
                  >
                    Skip to content
                  </a>
                  <Navbar />
                  <main id="main">{children}</main>
                  <Footer />
                  <ComparisonTray />
                </PaletteProvider>
              </MotionProvider>
            </SessionProvider>
          </MotionPreferenceProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
