import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'AXIOM AI - The Intelligence Standard.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Default OG image (1200x630), prerendered at build time with the bundled Geist font. */
export default async function Image() {
  const font = await readFile(join(process.cwd(), 'src/app/Geist-Medium.ttf'));
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 96,
        background: 'radial-gradient(60% 70% at 50% 0%, #16213f 0%, #08090C 70%)',
        color: '#F5F7FA',
        fontFamily: 'Geist',
      }}
    >
      <svg width="96" height="96" viewBox="0 0 32 32" fill="none">
        <path d="M4 28 L14.2 5 H17.8 L28 28" stroke="#F5F7FA" strokeWidth="3" />
        <path d="M8.6 21.5 H12.4" stroke="#F5F7FA" strokeWidth="3" />
        <path d="M19.6 21.5 H23.4" stroke="#F5F7FA" strokeWidth="3" />
        <path d="M16 11.5 L18.6 17.5 H13.4 Z" fill="#5685FF" />
      </svg>
      <div style={{ fontSize: 96, letterSpacing: '-0.04em', marginTop: 40 }}>AXIOM AI</div>
      <div style={{ fontSize: 40, color: '#A0A7B7', marginTop: 16 }}>
        The Intelligence Standard.
      </div>
    </div>,
    { ...size, fonts: [{ name: 'Geist', data: font, weight: 500, style: 'normal' }] },
  );
}
