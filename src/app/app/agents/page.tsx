import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Agents", description: "Your agents — they suggest, you decide." };

export default function Page() {
  return <PersonalApp screen="agents" />;
}
