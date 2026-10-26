import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Your week", description: "Your weekly recap." };

export default function Page() {
  return <PersonalApp screen="recap" />;
}
