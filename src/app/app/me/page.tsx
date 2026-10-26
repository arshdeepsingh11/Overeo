import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Me", description: "What OVEREO knows about you, and your settings." };

export default function Page() {
  return <PersonalApp screen="me" />;
}
