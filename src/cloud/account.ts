"use client";

/* =====================================================================
   Accounts in the OVEREO backend: sign up, log in, log out, family
   profiles. Her space keeps working on the device either way; when she
   is signed in, everything is also stored in the backend and synced to
   her other devices (src/cloud/sync.ts).
   ===================================================================== */

import { useSyncExternalStore } from "react";
import { api, ApiError, profileKeys } from "./api";
import { createAccount, removeProfile, saveProfile, space, switchProfile } from "../personal/space";
import type { Account, Goal, LifeStage, Relation } from "../personal/types";

export interface CloudUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}
export interface CloudProfile {
  id: string;
  name: string;
  relation: Relation;
  isPrimary: boolean;
  birthYear: number | null;
  lifeStage: LifeStage;
  goals: Goal[];
  typicalCycle: number | null;
  hue: number;
  hasPin: boolean;
  consent: Account["consent"];
  createdAt: string;
  updatedAt: string;
}

export interface CloudState {
  /** checking: asking the server · off: no backend on this website · signed-out · signed-in */
  status: "checking" | "off" | "signed-out" | "signed-in";
  user: CloudUser | null;
  /** last sync: idle · syncing · offline · error */
  sync: "idle" | "syncing" | "offline" | "error";
  lastSync: string | null;
}

const USER_KEY = "overeo.cloud.user";
let state: CloudState = { status: "checking", user: null, sync: "idle", lastSync: null };
const subs = new Set<() => void>();
export const cloud = {
  get: () => state,
  set(p: Partial<CloudState>) {
    state = { ...state, ...p };
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => void subs.delete(f);
  },
};
const SERVER: CloudState = { status: "checking", user: null, sync: "idle", lastSync: null };
export function useCloud<T>(pick: (s: CloudState) => T): T {
  return useSyncExternalStore(cloud.subscribe, () => pick(cloud.get()), () => pick(SERVER));
}

function rememberUser(u: CloudUser | null) {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch {}
}
function rememberedUser(): CloudUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? "null");
  } catch {
    return null;
  }
}

/** A backend profile as her space's Account. */
export function toAccount(p: CloudProfile, user: CloudUser, prev?: Account | null): Account {
  return {
    ...(prev ?? {}),
    id: p.id,
    name: p.name,
    email: p.isPrimary ? user.email : prev?.email,
    createdAt: p.createdAt,
    goals: p.goals.length ? p.goals : (prev?.goals ?? ["general"]),
    stage: p.lifeStage,
    typicalCycle: p.typicalCycle ?? undefined,
    birthYear: p.birthYear ?? undefined,
    consent: p.consent,
    relation: p.relation,
    hue: p.hue,
    cloud: { userId: user.id, profileId: p.id, hasPin: p.hasPin },
    pin: null,
  };
}

/** Keep this device's profiles in step with the backend. */
function adopt(user: CloudUser, profiles: CloudProfile[]) {
  const s = space.get();
  // profiles of someone else who used this device and didn't log out
  for (const a of s.profiles) if (a.cloud && a.cloud.userId !== user.id) removeProfile(a.id);
  for (const p of profiles) saveProfile(toAccount(p, user, space.get().profiles.find((a) => a.id === p.id)));
  // removed on another device
  for (const a of space.get().profiles) if (a.cloud && a.cloud.userId === user.id && !profiles.some((p) => p.id === a.id)) removeProfile(a.id);
}

/** On start: is she signed in? Is there a backend at all? */
export async function checkSession() {
  try {
    const r = await api<{ user: CloudUser | null; profiles: CloudProfile[] }>("GET", "/auth/session", undefined, { timeout: 8000 });
    if (!r.user) throw new ApiError(401, "signed_out", "Please sign in.");
    rememberUser(r.user);
    adopt(r.user, r.profiles);
    cloud.set({ status: "signed-in", user: r.user });
  } catch (e) {
    const err = e as ApiError;
    if (err.status === 401) {
      // her session ended (expired or logged out elsewhere): her cloud profiles leave this device
      const had = rememberedUser();
      if (had) for (const a of space.get().profiles) if (a.cloud) removeProfile(a.id);
      rememberUser(null);
      cloud.set({ status: "signed-out", user: null });
    } else if (err.code === "no_backend") cloud.set({ status: "off", user: null });
    else {
      // offline / server down: keep working with what's on the device
      const u = rememberedUser();
      cloud.set({ status: u ? "signed-in" : "off", user: u, sync: "offline" });
    }
  }
  return cloud.get();
}

function openPrimary(profiles: CloudProfile[]) {
  const p = profiles.find((x) => x.isPrimary) ?? profiles[0];
  if (p) switchProfile(p.id);
}

export async function signUp(name: string, email: string, password: string) {
  const r = await api<{ user: CloudUser; profiles: CloudProfile[] }>("POST", "/auth/signup", { name, email, password });
  rememberUser(r.user);
  adopt(r.user, r.profiles);
  cloud.set({ status: "signed-in", user: r.user });
  // move what she already logged on this device (a local space) into her new account
  return r;
}

export async function logIn(email: string, password: string) {
  const r = await api<{ user: CloudUser; profiles: CloudProfile[] }>("POST", "/auth/login", { email, password });
  rememberUser(r.user);
  adopt(r.user, r.profiles);
  cloud.set({ status: "signed-in", user: r.user });
  openPrimary(r.profiles);
  return r;
}

/** Log out: her data stays safe in the backend and leaves this device. */
export async function logOut() {
  try {
    await api("POST", "/auth/logout", {});
  } catch {}
  for (const a of space.get().profiles) if (a.cloud) removeProfile(a.id);
  profileKeys.clear();
  rememberUser(null);
  cloud.set({ status: "signed-out", user: null, lastSync: null });
}

/* ------------------------------ family profiles ------------------------------ */

export interface NewProfile {
  name: string;
  relation: Exclude<Relation, "self">;
  birthYear?: number;
  lifeStage: LifeStage;
  goals: Goal[];
  hue: number;
  pin?: string;
}

export async function addCloudProfile(p: NewProfile) {
  const user = cloud.get().user!;
  const r = await api<{ profile: CloudProfile; key?: string }>("POST", "/profiles", { ...p, birthYear: p.birthYear ?? null, pin: p.pin || undefined });
  profileKeys.set(r.profile.id, r.key);
  const a = toAccount(r.profile, user);
  createAccount(a, { open: false });
  return a;
}

export async function updateCloudProfile(id: string, patch: Partial<{ name: string; birthYear: number | null; lifeStage: LifeStage; goals: Goal[]; typicalCycle: number | null; hue: number; consent: Account["consent"]; pin: string | null }>) {
  const r = await api<{ profile: CloudProfile; key?: string }>("PATCH", `/profiles/${id}`, patch, { profileId: id });
  profileKeys.set(id, r.key);
  const user = cloud.get().user;
  if (user) saveProfile(toAccount(r.profile, user, space.get().profiles.find((a) => a.id === id)));
  return r.profile;
}

export async function unlockCloudProfile(id: string, pin: string) {
  const r = await api<{ key: string | null }>("POST", `/profiles/${id}/unlock`, { pin });
  profileKeys.set(id, r.key);
  return true;
}

export const isUnlocked = (a: Account) => !a.cloud?.hasPin || !!profileKeys.get(a.id);

export async function deleteCloudProfile(id: string, password: string) {
  await api("DELETE", `/profiles/${id}`, { password }, { profileId: id });
  removeProfile(id);
}

export async function changePassword(current: string, next: string) {
  await api("POST", "/auth/password", { current, next });
}

export async function deleteCloudAccount(password: string) {
  await api("DELETE", "/account", { password });
  for (const a of space.get().profiles) if (a.cloud) removeProfile(a.id);
  profileKeys.clear();
  rememberUser(null);
  cloud.set({ status: "signed-out", user: null });
}

export async function forgotPassword(email: string) {
  return api<{ message: string }>("POST", "/auth/forgot", { email });
}
export async function resetPassword(token: string, password: string) {
  await api("POST", "/auth/reset", { token, password });
}

export { ApiError };
