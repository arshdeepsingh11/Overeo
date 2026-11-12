import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Who's checking in", description: "Choose a profile or add someone in your family." };

export default function Page() {
  return <PersonalApp screen="profiles" />;
}
