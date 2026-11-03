import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to OVEREO with a code sent to your email." };

export default function Page() {
  return <PersonalApp screen="signin" />;
}
