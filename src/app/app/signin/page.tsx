import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Log in", description: "Log in to OVEREO or create your account." };

export default function Page() {
  return <PersonalApp screen="signin" />;
}
