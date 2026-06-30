/**
 * Preload for headless sdc-eval CLI (tsx --import).
 * Vite injects import.meta.env in the browser build; Node needs a stub.
 */
type ImportMetaEnv = Record<string, string | boolean | undefined>;

const meta = import.meta as ImportMeta & { env?: ImportMetaEnv };

if (!meta.env) {
  meta.env = {
    DEV: false,
    PROD: true,
    MODE: "production",
    BASE_URL: "/",
  };
}

export {};
