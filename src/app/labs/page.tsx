import type { Metadata } from "next";
import { LabsView } from "@/views/MoreViews";

export const metadata: Metadata = { title: "OVEREO Labs", description: "What's coming to women's health by 2035." };

export default function Page() {
  return <LabsView />;
}
