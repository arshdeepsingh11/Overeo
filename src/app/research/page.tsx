import type { Metadata } from "next";
import { ResearchView } from "@/views/MoreViews";

export const metadata: Metadata = { title: "Research", description: "Science Commons and the evidence library." };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <ResearchView initialTab={tab} />;
}
