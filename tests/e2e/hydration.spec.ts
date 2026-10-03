import { expect, test } from '@playwright/test';
import { gotoReady } from './helpers';

/**
 * Hydration must be clean whatever the user's motion preference. A component that branched on
 * `useReducedMotion()` while rendering produced different server and first-client markup, which
 * React reports as a hydration error (minified in production builds as error #418/#423/#425).
 */
const HYDRATION = /hydrat|Minified React error #(418|419|422|423|425)/i;

const ROUTES = [
  '/',
  '/models',
  '/models/sample-model-2',
  '/compare?models=sample-model-1,sample-model-2',
];

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test.describe(`hydration, prefers-reduced-motion: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    for (const route of ROUTES) {
      test(`${route} hydrates without errors`, async ({ page }) => {
        const problems: string[] = [];
        page.on('console', (m) => {
          if (m.type() === 'error' && HYDRATION.test(m.text())) problems.push(m.text());
        });
        page.on('pageerror', (e) => {
          if (HYDRATION.test(e.message)) problems.push(e.message);
        });
        await gotoReady(page, route);
        await page.waitForTimeout(800); // let late hydration and motion settle
        expect(problems).toEqual([]);
      });
    }
  });
}
