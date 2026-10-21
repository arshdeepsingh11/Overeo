import type { StreamId } from "../core/streams";

/* ------------------------------------------------------------------ *
 * BioAro Labs tests featured on Home.
 *
 * Names, sample types, turnaround and marker counts are taken from each
 * test's page on bioarolabs.com (checked October 2026). Images are
 * BioAro Labs' own product images, loaded from their site. The "learn"
 * text is OVEREO's plain-language explanation; clinical claims cite the
 * guideline they come from. Panels change — the link is the source of
 * truth.
 * ------------------------------------------------------------------ */

export type LabArea = "Hormones" | "Microbiome" | "Nutrition" | "Heart" | "Genome" | "Stress";

export const LAB_AREAS: LabArea[] = ["Hormones", "Microbiome", "Nutrition", "Heart", "Genome", "Stress"];

export interface LabTest {
  slug: string;
  name: string;
  /** the subtitle BioAro uses, if any */
  sub?: string;
  area: LabArea;
  streams: StreamId[];
  tagline: string;
  learn: string;
  sample: string;
  results: string;
  markers: string;
  prep?: string;
  /** matching entry in the Test Navigator catalog, so SI can rank it for her */
  catalogId?: string;
  /** used when there is no catalog entry */
  fallback?: { tier: "not-now" | "later"; reason: string };
}

const SITE = "https://bioarolabs.com";
export const labUrl = (t: LabTest) => `${SITE}/product/${t.slug}`;
export const labHero = (t: LabTest) => `${SITE}/pdp/heroes/${t.slug}.jpg`;
export const labIcon = (t: LabTest) => `${SITE}/explore/icons/${t.slug}.png`;
export const LABS_HOME = `${SITE}/explore-tests`;

export const LAB_TESTS: LabTest[] = [
  {
    slug: "progesterone",
    name: "Progesterone",
    area: "Hormones",
    streams: ["cycle", "temp"],
    tagline: "Confirms that ovulation happened.",
    learn:
      "Progesterone rises only after an egg is released. Drawn about seven days before the next period, a clearly raised level confirms ovulation — the blood-test partner to a temperature shift.",
    sample: "Serum",
    results: "2–3 weeks",
    markers: "1 biomarker",
    catalogId: "progesterone",
  },
  {
    slug: "estradiol-e2",
    name: "Estradiol",
    sub: "E2",
    area: "Hormones",
    streams: ["cycle", "clock"],
    tagline: "The main estrogen of the reproductive years.",
    learn:
      "Estradiol shapes the cycle, bone and metabolism. It swings more than tenfold across a cycle, so a result only means something next to the cycle day it was drawn — usually days 2–4, alongside FSH.",
    sample: "Serum",
    results: "2–3 weeks",
    markers: "1 biomarker",
    catalogId: "fsh-e2",
  },
  {
    slug: "hormone-health",
    name: "Hormone Health",
    area: "Hormones",
    streams: ["cycle", "symptoms"],
    tagline: "Steroid hormones and SHBG in one draw.",
    learn:
      "Brings androgens, adrenal hormones and SHBG together — the picture clinicians look at when cycles are irregular or signs of high androgens (acne, unwanted hair) raise the question of PCOS.",
    sample: "Serum",
    results: "2–3 weeks",
    markers: "6 biomarkers",
    catalogId: "hormone-health",
  },
  {
    slug: "testosterone",
    name: "Total Testosterone",
    area: "Hormones",
    streams: ["cycle"],
    tagline: "The first blood test for high androgens in women.",
    learn:
      "The 2023 international PCOS guideline starts with total and free testosterone when checking for high androgens. Hormonal contraception lowers results, so it's read with her contraception in mind.",
    sample: "Serum",
    results: "2–3 weeks",
    markers: "1 biomarker",
    catalogId: "androgens",
  },
  {
    slug: "shbg-sex-hormone-binding-globulin",
    name: "SHBG",
    sub: "Sex hormone-binding globulin",
    area: "Hormones",
    streams: ["cycle"],
    tagline: "How much hormone is actually free to act.",
    learn:
      "SHBG carries testosterone and estradiol in the blood; only the unbound part is active. Free testosterone is calculated from total testosterone and SHBG, and low SHBG is linked with insulin resistance.",
    sample: "Serum",
    results: "2–3 weeks",
    markers: "1 biomarker",
    catalogId: "androgens",
  },
  {
    slug: "the-biofemme-test",
    name: "BioFemme",
    area: "Microbiome",
    streams: ["micro"],
    tagline: "A species-level map of the vaginal microbiome.",
    learn:
      "Identifies the bacteria, fungi and archaea living in the vaginal ecosystem. Communities dominated by Lactobacillus — especially L. crispatus — are linked with a lower pH and fewer signs of bacterial vaginosis.",
    sample: "Vaginal swabs",
    results: "3–4 weeks",
    markers: "1 biomarker",
    prep: "No antibiotics in the prior 2 months",
    catalogId: "biofemme",
  },
  {
    slug: "the-biogut-test",
    name: "BioGut",
    area: "Microbiome",
    streams: ["micro", "symptoms"],
    tagline: "A species-level map of the gut microbiome.",
    learn:
      "Profiles the bacterial, fungal and archaeal species in the gut. Helpful context for diet and digestion — few single microbiome results change treatment on their own yet, so it's best read alongside her symptoms.",
    sample: "Stool sample",
    results: "3–4 weeks",
    markers: "1 biomarker",
    prep: "No antibiotics in the prior 2 months",
    catalogId: "biogut",
  },
  {
    slug: "vitamin-d2-d3",
    name: "Vitamin D",
    sub: "25-hydroxy, D2 + D3",
    area: "Nutrition",
    streams: ["labs"],
    tagline: "The standard measure of vitamin D status.",
    learn:
      "25-hydroxy vitamin D reflects intake and sunlight over the past weeks. Osteoporosis Canada suggests at least 75 nmol/L for bone health — and Calgary's winter sun is too weak to make much vitamin D.",
    sample: "Serum",
    results: "2–3 weeks",
    markers: "2 biomarkers",
    catalogId: "vitamin-d",
  },
  {
    slug: "essential-vitamin-health",
    name: "Essential Vitamin Health",
    area: "Nutrition",
    streams: ["labs"],
    tagline: "Vitamins A, D, E and K in one panel.",
    learn:
      "Fat-soluble vitamins are stored in the body, so both too little and too much can matter. Together they also hint at how well fat is being absorbed.",
    sample: "Serum",
    results: "2–3 weeks",
    markers: "6 biomarkers",
    catalogId: "essential-vitamins",
  },
  {
    slug: "high-sensitive-crp-hs-crp",
    name: "hs-CRP",
    sub: "High-sensitivity C-reactive protein",
    area: "Heart",
    streams: ["heart"],
    tagline: "Low-grade inflammation, measured precisely.",
    learn:
      "In the 2019 ACC/AHA prevention guideline, an hs-CRP of 2 mg/L or more is a risk-enhancing factor — listed alongside women-specific ones such as early menopause and a history of preeclampsia.",
    sample: "Plasma",
    results: "2–3 weeks",
    markers: "1 biomarker",
    catalogId: "hs-crp",
  },
  {
    slug: "pharmacogenomics-test",
    name: "Pharmacogenomics",
    area: "Genome",
    streams: ["genome", "meds"],
    tagline: "How her genes shape her response to medicines.",
    learn:
      "Reads variants in genes such as CYP2C19 and CYP2D6 that change how medicines are activated or cleared. CPIC guidelines turn those results into dose and drug-choice advice.",
    sample: "Whole blood",
    results: "4–6 weeks",
    markers: "1 panel",
    prep: "Referral needed (USA only)",
    catalogId: "pgx",
  },
  {
    slug: "cortisol",
    name: "Cortisol",
    area: "Stress",
    streams: ["sleep"],
    tagline: "The body's stress-response hormone.",
    learn:
      "Cortisol follows a daily rhythm that peaks in the morning, so draw time matters. Clinicians use it to check for adrenal insufficiency or excess — 'adrenal fatigue' isn't a recognised diagnosis, and one value can't confirm it.",
    sample: "Serum",
    results: "2–3 weeks",
    markers: "1 biomarker",
    fallback: { tier: "not-now", reason: "Her tiredness has a clearer lead — low ferritin — so cortisol wouldn't change the next step." },
  },
];
