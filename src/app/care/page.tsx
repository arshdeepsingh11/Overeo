import type { Metadata } from "next";
import { CareView } from "@/views/CareView";

export const metadata: Metadata = { title: "Care team", description: "The OVEREO ecosystem, visits and the agent." };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <CareView initialTab={tab} />;
}
