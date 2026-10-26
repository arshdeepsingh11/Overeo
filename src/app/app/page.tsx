import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Today", description: "Your day, your rhythm, your agents." };

export default function Page() {
  return <PersonalApp screen="today" />;
}
