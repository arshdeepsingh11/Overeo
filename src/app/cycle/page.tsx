import type { Metadata } from "next";
import { CycleView } from "@/views/CycleView";

export const metadata: Metadata = { title: "Cycle", description: "Cycle Lens, forecast, patterns and phases." };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <CycleView initialTab={tab} />;
}
