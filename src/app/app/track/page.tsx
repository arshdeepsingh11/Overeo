import type { Metadata } from "next";
import { PersonalApp } from "@/views/app/PersonalApp";

export const metadata: Metadata = { title: "Track", description: "Log anything in two taps." };

export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string; review?: string }> }) {
  const { t, review } = await searchParams;
  return <PersonalApp screen="track" t={t} review={review === "1"} />;
}
