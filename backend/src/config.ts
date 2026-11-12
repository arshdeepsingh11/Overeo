/* All settings come from environment variables (see .env.example). */
const env = process.env;
const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export const config = {
  port: Number(env.PORT ?? 4000),
  host: env.HOST ?? "0.0.0.0",
  databaseUrl: env.DATABASE_URL ?? "",
  /** the website(s) allowed to call the API with cookies, e.g. https://overeo.com */
  allowedOrigins: list(env.ALLOWED_ORIGINS ?? "http://localhost:3000"),
  /** long random string; signs profile unlock tokens */
  secret: env.APP_SECRET ?? "",
  cookieName: env.COOKIE_NAME ?? "overeo_session",
  /** Secure cookies need HTTPS — keep true in production */
  cookieSecure: (env.COOKIE_SECURE ?? (env.NODE_ENV === "production" ? "true" : "false")) === "true",
  cookieDomain: env.COOKIE_DOMAIN || undefined,
  sessionDays: Number(env.SESSION_DAYS ?? 30),
  storageDir: env.STORAGE_DIR ?? "./storage",
  maxFileMb: Number(env.MAX_FILE_MB ?? 15),
  maxProfiles: Number(env.MAX_PROFILES ?? 8),
  autoMigrate: (env.AUTO_MIGRATE ?? "true") === "true",
  /** behind nginx / a load balancer: trust X-Forwarded-For for the client IP */
  trustProxy: (env.TRUST_PROXY ?? "true") === "true",
  /** "console" until email is connected; then "smtp" (see src/lib/mail.ts) */
  emailTransport: env.EMAIL_TRANSPORT ?? "console",
  appUrl: env.APP_URL ?? "http://localhost:3000",
};

export function checkConfig() {
  const problems: string[] = [];
  if (!config.databaseUrl) problems.push("DATABASE_URL is not set");
  if (config.secret.length < 32) problems.push("APP_SECRET must be at least 32 characters");
  if (env.NODE_ENV === "production" && !config.cookieSecure) problems.push("COOKIE_SECURE must be true in production");
  return problems;
}
