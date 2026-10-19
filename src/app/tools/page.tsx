import type { Metadata } from "next";
import { ToolsView } from "@/views/ToolsView";

export const metadata: Metadata = { title: "Tools", description: "Guided check-ins and validated questionnaires." };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  return <ToolsView initialTab={tab} />;
}
