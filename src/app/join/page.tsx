import type { Metadata } from "next";
import { JoinView } from "@/views/MoreViews";

export const metadata: Metadata = { title: "Join", description: "The OVEREO app and early access." };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <JoinView initialTab={tab} />;
}
