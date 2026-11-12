import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Ask the team", description: "Your OVEREO agents work on one request together — every claim checked." };

export default function Page() {
  return <PersonalApp screen="team" />;
}
