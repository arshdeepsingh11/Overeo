import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Visit summary", description: "One page for your clinician, from your own records." };

export default function Page() {
  return <PersonalApp screen="visit" />;
}
