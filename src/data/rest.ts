import type { DataAdapter, FilesAdapter, Session } from "./adapters";
import type { Account, AgentId, AgentSettings, AnyRecord, DiaryEntry, MemoryItem, MemoryOverride, Reminder, Suggestion } from "../personal/types";

/* =====================================================================
   REST client for a custom OVEREO backend — matches docs/BACKEND.md.
   Not active until NEXT_PUBLIC_DATA_BACKEND=rest and NEXT_PUBLIC_API_URL
   are set and the endpoints exist. Every call is authenticated and
   scoped to the signed-in account; the server enforces it too.
   ===================================================================== */

const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

export function restClient(session: () => Session | null): DataAdapter & FilesAdapter {
  const call = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
    const s = session();
    const res = await fetch(`${API}/v1${path}`, {
      method,
      headers: { "content-type": "application/json", ...(s ? { authorization: `Bearer ${s.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
    return (res.status === 204 ? undefined : await res.json()) as T;
  };
  const q = (since?: string) => (since ? `?since=${encodeURIComponent(since)}` : "");
  return {
    getAccount: () => call<Account>("GET", "/me"),
    updateAccount: (patch) => call<Account>("PATCH", "/me", patch),
    deleteAccount: () => call<void>("DELETE", "/me"),
    exportAll: async () => new Blob([JSON.stringify(await call("GET", "/me/export"))], { type: "application/json" }),
    listRecords: (since) => call<AnyRecord[]>("GET", `/records${q(since)}`),
    upsertRecords: (records) => call("POST", "/records:batch", { records }),
    listReminders: () => call<Reminder[]>("GET", "/reminders"),
    upsertReminders: (r) => call<void>("PUT", "/reminders", r),
    listDiary: (since) => call<DiaryEntry[]>("GET", `/diary${q(since)}`),
    appendDiary: (e) => call<void>("POST", "/diary", e),
    getAgents: () => call<Record<AgentId, AgentSettings>>("GET", "/agents"),
    putAgents: (a) => call<void>("PUT", "/agents", a),
    listInbox: () => call<Suggestion[]>("GET", "/inbox"),
    putInbox: (s) => call<void>("PUT", "/inbox", s),
    getMemory: () => call<{ overrides: MemoryOverride[]; told: MemoryItem[] }>("GET", "/memory"),
    putMemory: (m) => call<void>("PUT", "/memory", m),
    upload: async (file, meta) => {
      const s = session();
      const form = new FormData();
      form.append("file", file);
      form.append("kind", meta.kind);
      const res = await fetch(`${API}/v1/files`, { method: "POST", headers: s ? { authorization: `Bearer ${s.token}` } : {}, body: form });
      if (!res.ok) throw new Error(`upload → ${res.status}`);
      return res.json();
    },
    download: async (id) => {
      const s = session();
      const res = await fetch(`${API}/v1/files/${id}`, { headers: s ? { authorization: `Bearer ${s.token}` } : {} });
      if (!res.ok) throw new Error(`download → ${res.status}`);
      return res.blob();
    },
    remove: (id) => call<void>("DELETE", `/files/${id}`),
  };
}
