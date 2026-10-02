// Minimal typing for Vite's static `import.meta.glob`, used by tests to enumerate route modules.
interface ImportMeta {
  glob<T = unknown>(pattern: string): Record<string, () => Promise<T>>;
}
