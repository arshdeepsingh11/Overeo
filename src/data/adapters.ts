import type { Account, AgentId, AgentSettings, AnyRecord, DiaryEntry, MemoryItem, MemoryOverride, Reminder, Suggestion } from "../personal/types";

/* =====================================================================
   Backend contract — what OVEREO needs from a server, in one place.

   Today everything runs on the device (src/personal/db.ts + space.ts).
   When a backend exists, implement these interfaces (see ./rest.ts for a
   ready REST client) and switch with NEXT_PUBLIC_DATA_BACKEND=rest.
   Nothing in the UI changes: screens read the space store, the store
   writes through the adapter, and an outbox syncs when back online.

   Full mapping, endpoints and data rules: docs/BACKEND.md
   ===================================================================== */

export interface Session {
  accountId: string;
  token: string;
  expiresAt: string;
}

/** Sign-in. Local accounts now; OIDC / passkeys / custom later. */
export interface AuthAdapter {
  signUp(input: { name: string; email: string; password?: string }): Promise<Session>;
  signIn(input: { email: string; password?: string; passkey?: boolean }): Promise<Session>;
  signOut(): Promise<void>;
  /** magic link / one-time code */
  requestCode?(email: string): Promise<void>;
  verifyCode?(email: string, code: string): Promise<Session>;
}

/** Her records and everything around them, always scoped to her account. */
export interface DataAdapter {
  getAccount(): Promise<Account>;
  updateAccount(patch: Partial<Account>): Promise<Account>;
  deleteAccount(): Promise<void>;
  exportAll(): Promise<Blob>;

  listRecords(since?: string): Promise<AnyRecord[]>;
  /** create, correct (new revision), confirm/reject, archive — the server keeps every revision */
  upsertRecords(records: AnyRecord[]): Promise<{ accepted: string[]; conflicts: { id: string; server: AnyRecord }[] }>;

  listReminders(): Promise<Reminder[]>;
  upsertReminders(r: Reminder[]): Promise<void>;
  listDiary(since?: string): Promise<DiaryEntry[]>;
  appendDiary(e: DiaryEntry[]): Promise<void>;
  getAgents(): Promise<Record<AgentId, AgentSettings>>;
  putAgents(a: Record<AgentId, AgentSettings>): Promise<void>;
  listInbox(): Promise<Suggestion[]>;
  putInbox(s: Suggestion[]): Promise<void>;
  getMemory(): Promise<{ overrides: MemoryOverride[]; told: MemoryItem[] }>;
  putMemory(m: { overrides: MemoryOverride[]; told: MemoryItem[] }): Promise<void>;
}

/** Report photos / PDFs. Encrypted at rest; never sent to an AI model without consent. */
export interface FilesAdapter {
  upload(file: Blob, meta: { kind: "lab-report" | "visit-summary" | "other" }): Promise<{ documentId: string }>;
  download(documentId: string): Promise<Blob>;
  remove(documentId: string): Promise<void>;
}

/** Ordering tests (BioAro Labs runs on Shopify — see src/integrations/shopify.ts). */
export interface CommerceAdapter {
  product(handle: string): Promise<{ id: string; title: string; price: string; currency: string; image?: string; variantId: string } | null>;
  addToCart(variantId: string, quantity?: number): Promise<{ checkoutUrl: string }>;
}

/** Push notifications for reminders when the app is closed (needs a server + VAPID keys). */
export interface PushAdapter {
  subscribe(sub: PushSubscriptionJSON): Promise<void>;
  unsubscribe(): Promise<void>;
}

export type Backend = "local" | "rest";
export const BACKEND: Backend = process.env.NEXT_PUBLIC_DATA_BACKEND === "rest" ? "rest" : "local";
