import type { Metadata } from "next";
import { WhyView } from "@/views/WhyView";

export const metadata: Metadata = { title: "Why OVEREO", description: "What OVEREO is, how it helps, your team of helpers and how to turn them on — in plain words." };

export default function Page() {
  return <WhyView />;
}
