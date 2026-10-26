import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Welcome", description: "Create your private OVEREO space." };

export default function Page() {
  return <PersonalApp screen="welcome" />;
}
