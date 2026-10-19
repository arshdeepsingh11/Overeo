/* Research facts used on the site. Each carries its source so the UI can cite it. */

export interface Fact {
  id: string;
  value: number;
  prefix?: string;
  suffix: string;
  label: string;
  detail: string;
  source: string;
  url: string;
}

export const FACTS: Fact[] = [
  {
    id: "dx",
    value: 770,
    suffix: "",
    label: "diseases diagnosed later in women",
    detail: "A 21-year Danish population study found women were diagnosed later than men across 770 diseases — cancer ~2.5 years later, diabetes ~4.5 years later.",
    source: "Westergaard et al., Nature Communications (2019)",
    url: "https://www.cpr.ku.dk/cpr-news/2019/study-across-diseases-women-are-diagnosed-later-than-men",
  },
  {
    id: "endo",
    value: 10,
    suffix: " yrs",
    label: "average wait for an endometriosis diagnosis",
    detail: "A prospective French e-cohort of ~6,950 women reported an average delay of 10 years for endometriosis and 11 for adenomyosis.",
    source: "ComPaRe-Endometriosis, Journal of Women's Health (2026)",
    url: "https://www.contemporaryobgyn.net/view/women-with-endometriosis-or-adenomyosis-face-10--to-11-year-diagnostic-delays-study-finds",
  },
  {
    id: "meno",
    value: 84,
    suffix: "%",
    label: "with menopause symptoms didn't seek care",
    detail: "In a Mayo Clinic survey of ~5,000 women aged 45–60, nearly 84% had not sought care for menopause symptoms and only 28% were being treated.",
    source: "Mayo Clinic Proceedings (2025)",
    url: "https://newsnetwork.mayoclinic.org/discussion/mayo-clinic-study-finds-majority-of-midlife-women-with-menopause-symptoms-do-not-seek-care",
  },
  {
    id: "adr",
    value: 2,
    suffix: "×",
    label: "more adverse drug reactions in women",
    detail: "Analysing 86 FDA-approved drugs, researchers found women experience adverse drug reactions nearly twice as often, largely because doses were set in male-dominated trials.",
    source: "Zucker & Prendergast, Biology of Sex Differences (2020)",
    url: "https://bsd.biomedcentral.com/articles/10.1186/s13293-020-00308-5",
  },
  {
    id: "gap",
    value: 25,
    suffix: "%",
    label: "more of life spent in poor health",
    detail: "Women live longer than men but spend about 25% more of their lives in poor health.",
    source: "World Economic Forum × McKinsey Health Institute (2024)",
    url: "https://www.weforum.org/publications/closing-the-women-s-health-gap-a-1-trillion-opportunity-to-improve-lives-and-economies/",
  },
];

export const DELAYS = [
  { label: "Endometriosis", years: 10, note: "avg. delay from symptoms" },
  { label: "Metabolic disease", years: 4.5, note: "later than men" },
  { label: "Cancer", years: 2.5, note: "later than men" },
];

export const OVARY_FACT = {
  text: "Ovaries are the fastest-ageing organ in the body — and the earlier they age, the higher the later risk of heart disease, dementia and earlier death.",
  source: "Columbia University Irving Medical Center",
  url: "https://www.cuimc.columbia.edu/news/studying-ovaries-understand-how-we-all-age",
};

export const MENSTRUAL_FACT = {
  text: "A 2026 study showed tampon-based sampling can reproducibly measure hormonal, inflammatory and neurological biomarkers in menstrual fluid.",
  source: "American Academy of Neurology abstract (2026)",
  url: "https://index.mirasmart.com/AAN2026/PDFfiles/AAN2026-005103.html",
};
