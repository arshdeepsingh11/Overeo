import type { Metadata } from "next";
import { SpecialtiesIndex } from "@/views/SpecialtyView";

export const metadata: Metadata = { title: "Specialties", description: "Ten areas of women's care, one record." };

export default function Page() {
  return <SpecialtiesIndex />;
}
