import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SPECIALTIES, specialtyBySlug } from "@/content/specialties";
import { SpecialtyView } from "@/views/SpecialtyView";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return SPECIALTIES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const sp = specialtyBySlug((await params).slug);
  return sp ? { title: sp.name, description: sp.tagline } : {};
}

export default async function Page({ params, searchParams }: { params: Params; searchParams: Promise<{ tab?: string }> }) {
  const { slug } = await params;
  const { tab } = await searchParams;
  if (!specialtyBySlug(slug)) notFound();
  return <SpecialtyView slug={slug} initialTab={tab} />;
}
