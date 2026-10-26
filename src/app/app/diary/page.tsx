import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Diary", description: "Everything your agents did." };

export default function Page() {
  return <PersonalApp screen="diary" />;
}
