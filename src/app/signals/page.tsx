import type { Metadata } from "next";
import { SignalsView } from "@/views/SignalsView";

export const metadata: Metadata = { title: "Silent Signals", description: "Patterns medicine often misses — and where they go." };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <SignalsView initialTab={tab} />;
}
