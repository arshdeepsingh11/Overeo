/* The in-house ecosystem OVEREO is the women's front door to. */

export interface Org {
  id: string;
  name: string;
  role: string;
  gives: string;
  city: string;
  url?: string;
  hue: number;
}

export const ORGS: Org[] = [
  { id: "neyu", name: "NEYU Health", role: "Care & virtual clinic", gives: "Physicians, virtual visits, at-home blood collection", city: "Calgary", url: "https://neyuhealth.com/", hue: 330 },
  { id: "labs", name: "BioAro Labs", role: "Testing foundation", gives: "Genomics, microbiome, hormones, metabolic panels", city: "Calgary", url: "https://bioarolabs.com/", hue: 20 },
  { id: "drugs", name: "BioAro Drugs", role: "Precision protocols", gives: "AI-guided protocols with every ingredient and dose shown", city: "Calgary", url: "https://bioarodrugs.com/", hue: 300 },
  { id: "bio", name: "Biongevity", role: "Longevity & digital twin", gives: "The digital twin OVEREO adds a female layer to", city: "Dubai", url: "https://biongevity.com/", hue: 280 },
  { id: "acc", name: "Advanced Cardiology", role: "Heart & endocrinology", gives: "Women's heart care; PCOS, thyroid and diabetes specialists", city: "Calgary", url: "https://advancedcardiology.ca/", hue: 350 },
  { id: "nea", name: "NEA Precision Skin", role: "Skin from the inside", gives: "Gut, skin & vaginal microbiome; hormone-aware skin care", city: "Calgary", url: "https://www.neaskincare.com/", hue: 15 },
  { id: "emr", name: "BioEMR", role: "Clinical record", gives: "Signals reach clinicians inside their own record", city: "Calgary", hue: 250 },
  { id: "mynd", name: "BioMynd", role: "Sleep & mind", gives: "Cycle-timed sleep and mood support", city: "Calgary", hue: 265 },
  { id: "sport", name: "BioSport", role: "Performance", gives: "Cycle-synced training and recovery", city: "Calgary", hue: 35 },
  { id: "gut", name: "BioGut", role: "Nutrition", gives: "Registered-dietitian plans built on the microbiome", city: "Calgary", hue: 40 },
  { id: "bp", name: "Hypertension Clinic", role: "Remote monitoring", gives: "Home readings with physician review", city: "Calgary", hue: 355 },
  { id: "research", name: "BioAro Research", role: "Science", gives: "Women-specific biomarker discovery", city: "Calgary", hue: 310 },
];

export const HUBS = [
  { name: "Calgary", lon: -114.07, lat: 51.05, orgs: "NEYU · BioAro · Advanced Cardiology · NEA" },
  { name: "Dubai", lon: 55.27, lat: 25.2, orgs: "Biongevity UAE Precision Clinic" },
];
