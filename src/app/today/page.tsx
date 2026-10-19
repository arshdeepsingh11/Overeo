import type { Metadata } from "next";
import { TodayView } from "@/views/TodayView";

export const metadata: Metadata = { title: "Today", description: "Your day, forecast and next steps." };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <TodayView initialTab={tab} />;
}
