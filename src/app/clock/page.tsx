import type { Metadata } from "next";
import { ClockView } from "@/views/ClockView";

export const metadata: Metadata = { title: "Ovarian Clock", description: "Reproductive markers, fertility planning and the science behind them." };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <ClockView initialTab={tab} />;
}
