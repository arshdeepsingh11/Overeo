import type { Metadata } from "next";
import { PrivacyView } from "@/views/MoreViews";

export const metadata: Metadata = { title: "Privacy", description: "Consent one use at a time." };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <PrivacyView initialTab={tab} />;
}
