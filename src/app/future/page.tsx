import type { Metadata } from "next";
import { FutureView } from "@/views/FutureView";

export const metadata: Metadata = { title: "Future Self", description: "Two futures, milestones and a menopause plan." };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <FutureView initialTab={tab} />;
}
