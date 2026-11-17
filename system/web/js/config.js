export const config = Object.freeze(globalThis.RENTAL_CONFIG || {});
export const configured = Boolean(
  config.supabaseUrl &&
    config.supabasePublishableKey?.startsWith("sb_publishable_"),
);
