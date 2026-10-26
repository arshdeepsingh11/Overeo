import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Inbox", description: "Suggestions waiting for you." };

export default function Page() {
  return <PersonalApp screen="inbox" />;
}
