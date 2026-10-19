import type { Metadata } from "next";
import { TestsView } from "@/views/TestsView";

export const metadata: Metadata = { title: "Test Navigator", description: "BioAro Labs and NEA tests, recommended the scientific way." };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <TestsView initialTab={tab} />;
}
