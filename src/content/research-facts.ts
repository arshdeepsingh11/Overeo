/* =====================================================================
   Research facts — checked against the original sources (Nov 2026).

   Each fact is short, plain and cited. They feed the agents' knowledge
   base and the "Why OVEREO" page. Rules: only major health bodies
   (WHO, CDC, ASRM, AHA, IOF, FIGO, AASM…), only what the source says,
   no extrapolation, and no medicine doses.
   ===================================================================== */

export interface ResearchFact {
  id: string;
  /** big number or short headline for cards */
  stat: string;
  title: string;
  text: string;
  source: string;
  url: string;
  tags: string[];
  /** where in OVEREO this helps */
  help: string;
}

export const RESEARCH: ResearchFact[] = [
  {
    id: "endo",
    stat: "1 in 10",
    title: "Endometriosis",
    text: "Endometriosis affects an estimated 10% (190 million) of women of reproductive age worldwide. Symptoms include severe period pain, heavy bleeding, pelvic pain that doesn't go away after the period, infertility, bloating and nausea. There is no cure yet; treatment aims to control symptoms, and access to early diagnosis is limited in many places.",
    source: "World Health Organization — Endometriosis fact sheet (Oct 2025)",
    url: "https://www.who.int/news-room/fact-sheets/detail/endometriosis",
    tags: ["endometriosis", "menstrual", "cycle", "symptoms", "fertility"],
    help: "LUNA tracks pain with your cycle days, and SAGE turns the pattern into a visit summary — so you're heard sooner.",
  },
  {
    id: "pcos",
    stat: "Up to 70%",
    title: "PCOS often goes unnoticed",
    text: "PCOS affects an estimated 10–13% of women of reproductive age, and the WHO estimates up to 70% of women with PCOS don't know they have it. It is linked to irregular periods, ovulation problems, acne and extra hair growth, and to higher long-term risk of insulin resistance and type 2 diabetes. There is no cure, but lifestyle changes and treatment help.",
    source: "World Health Organization — PCOS fact sheet (Jan 2026)",
    url: "https://www.who.int/news-room/fact-sheets/detail/polycystic-ovary-syndrome",
    tags: ["pcos", "hormones", "cycle", "skin", "labs"],
    help: "LUNA flags cycles outside the normal range; VERA explains which hormone tests are actually useful.",
  },
  {
    id: "anaemia",
    stat: "30%",
    title: "Anaemia is common",
    text: "About 30% of women aged 15–49 worldwide have anaemia. Consistent heavy menstrual losses are a common cause, and iron deficiency is the most common nutritional cause.",
    source: "World Health Organization — Anaemia fact sheet (Feb 2025)",
    url: "https://www.who.int/news-room/fact-sheets/detail/anaemia",
    tags: ["labs", "iron", "ferritin", "fatigue", "menstrual", "mood", "sleep"],
    help: "VERA reads your ferritin and haemoglobin over time; NOOR connects tiredness to your sleep and cycle.",
  },
  {
    id: "hmb",
    stat: "1 pad / hour",
    title: "When bleeding is too heavy",
    text: "Signs of heavy menstrual bleeding include soaking through one or more pads or tampons every hour for several hours in a row, periods lasting more than 7 days, or clots the size of a quarter or larger. If this happens, see a healthcare provider; if no cause is found, ask about testing for a bleeding disorder.",
    source: "U.S. CDC — Heavy menstrual bleeding",
    url: "https://www.cdc.gov/female-blood-disorders/about/heavy-menstrual-bleeding.html",
    tags: ["menstrual", "cycle", "symptoms", "labs", "care", "safety"],
    help: "LUNA records your flow and how long periods last, so heavy bleeding isn't brushed off.",
  },
  {
    id: "meno",
    stat: "45–55",
    title: "Menopause",
    text: "Natural menopause usually happens between ages 45 and 55. The transition (perimenopause) starts with cycle changes and can last several years. Symptoms can include hot flushes and night sweats, sleep problems, mood changes, vaginal dryness and incontinence, and vary a lot between women. Bone density falls and the heart-health advantage gradually disappears after menopause. Hormonal and non-hormonal options can help — discuss them with a clinician.",
    source: "World Health Organization — Menopause fact sheet (Oct 2024)",
    url: "https://www.who.int/news-room/fact-sheets/detail/menopause",
    tags: ["menopause", "bone", "heart", "sleep", "mood"],
    help: "MAEVE tracks hot flashes, sleep and cycle changes, and prepares what to ask about treatment.",
  },
  {
    id: "bone",
    stat: "1 in 3",
    title: "Bone health after 50",
    text: "Worldwide, one in three women over 50 will have a fragility fracture in their remaining lifetime.",
    source: "International Osteoporosis Foundation (Oct 2025)",
    url: "https://www.osteoporosis.foundation/",
    tags: ["bone", "menopause"],
    help: "MAEVE explains when a bone-density scan is worth discussing.",
  },
  {
    id: "infertility",
    stat: "12 / 6 months",
    title: "When to get a fertility check",
    text: "With regular unprotected sex and no known cause, a fertility evaluation is recommended after 12 months if the woman is under 35, and after 6 months if she is 35 or older.",
    source: "American Society for Reproductive Medicine — Definition of infertility (2023)",
    url: "https://www.asrm.org/practice-guidance/practice-committee-documents/definition-of-infertility/",
    tags: ["fertility", "care"],
    help: "BLOOM keeps your timeline and tells you when it's time to ask for a check.",
  },
  {
    id: "apo",
    stat: "Later in life",
    title: "Pregnancy complications and the heart",
    text: "Pregnancy complications such as preeclampsia, gestational high blood pressure, gestational diabetes and preterm birth are linked to a higher risk of heart disease later in life, so they belong in a woman's heart-health history.",
    source: "American Heart Association scientific statement, Circulation (2021)",
    url: "https://pubmed.ncbi.nlm.nih.gov/33779213/",
    tags: ["heart", "care", "fertility"],
    help: "SAGE makes sure your pregnancy history is part of your visit summary.",
  },
  {
    id: "pmdd",
    stat: "About 5.5%",
    title: "PMDD is more than PMS",
    text: "Premenstrual dysphoric disorder (PMDD) is a severe, cycle-linked mood condition that starts in the days before a period and eases once it begins. The International Association for Premenstrual Disorders estimates it affects about 5.5% of people who menstruate. Tracking mood daily across two cycles helps a clinician tell it apart from other conditions.",
    source: "International Association for Premenstrual Disorders (IAPMD)",
    url: "https://faq.iapmd.org/en/articles/2609618-what-is-the-prevalence-of-premenstrual-disorders",
    tags: ["mood", "mind-sleep", "cycle", "menstrual"],
    help: "NOOR shows how your mood moves with your cycle — the daily record clinicians ask for.",
  },
  {
    id: "cycle-normal",
    stat: "24–38 days",
    title: "What a normal cycle looks like",
    text: "A typical cycle comes every 24–38 days, varies by no more than 7–9 days from cycle to cycle, and bleeding lasts up to 8 days.",
    source: "FIGO menstrual disorders system (2018)",
    url: "https://obgyn.onlinelibrary.wiley.com/doi/10.1002/ijgo.12666",
    tags: ["cycle", "menstrual"],
    help: "LUNA compares your own cycles with these ranges and tells you when something's outside them.",
  },
  {
    id: "sleep",
    stat: "7 hours+",
    title: "Sleep",
    text: "Adults should sleep 7 or more hours a night on a regular basis for good health.",
    source: "American Academy of Sleep Medicine & Sleep Research Society (2015)",
    url: "https://aasm.org/resources/pdf/pressroom/adult-sleep-duration-consensus.pdf",
    tags: ["sleep", "mood", "mind-sleep"],
    help: "NOOR learns how your sleep changes with your cycle and how it affects your mood.",
  },
  {
    id: "fertile-window",
    stat: "6 days",
    title: "The fertile window",
    text: "Pregnancy is possible only on about six days each cycle: the five days before ovulation and the day of ovulation.",
    source: "Wilcox, Weinberg & Baird, New England Journal of Medicine (1995)",
    url: "https://www.nejm.org/doi/full/10.1056/NEJM199512073332301",
    tags: ["fertility", "cycle"],
    help: "BLOOM estimates your window from your own cycles — and is honest that it's an estimate, not contraception.",
  },
];
