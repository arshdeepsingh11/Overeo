/* =====================================================================
   OVEREO Mind — general knowledge, used only to put HER data in context.

   Short, plain-language and conservative. Each entry names where it
   comes from. Nothing here diagnoses or doses; it explains, and says
   when to see someone.
   ===================================================================== */

export interface LabInfo {
  what: string;
  context: string;
  retest?: string;
  source: string;
  /** BioAro Labs product handle, when BioAro sells this test */
  bioaro?: string;
  /** a value is only meaningful at a certain point in the cycle */
  timing?: string;
}

export const LAB_INFO: Record<string, LabInfo> = {
  Ferritin: {
    what: "Ferritin shows how much iron your body has stored.",
    context: "Low ferritin means low iron stores — common with heavy periods, and it can cause tiredness even before your haemoglobin drops. Many specialists treat values under 30 ng/mL as low iron stores (some use 45), even when the report's range starts lower.",
    retest: "When iron is low, it's usually rechecked after about 3 months — your clinician decides the plan.",
    source: "WHO guideline on ferritin (2020)",
  },
  "Vitamin D": {
    what: "This measures 25-hydroxy vitamin D, the standard test of vitamin D status.",
    context: "Below about 50 nmol/L (20 ng/mL) is generally considered too low for bone health.",
    retest: "Often rechecked after about 3 months of a change.",
    source: "Institute of Medicine (2011) · Endocrine Society",
    bioaro: "vitamin-d2-d3",
  },
  AMH: {
    what: "AMH estimates how many eggs are left in the ovaries (ovarian reserve).",
    context: "It shows quantity, not egg quality, and on its own it doesn't predict your chance of getting pregnant naturally. It helps plan egg freezing or IVF.",
    source: "ASRM Committee Opinion (2020)",
    timing: "It can be drawn on any day of the cycle.",
  },
  TSH: {
    what: "TSH shows how hard your brain is asking the thyroid to work.",
    context: "A high TSH can mean an underactive thyroid (tiredness, heavier periods, feeling cold); a low TSH can mean an overactive one.",
    source: "American Thyroid Association",
  },
  HbA1c: {
    what: "HbA1c is your average blood sugar over the last 2–3 months.",
    context: "5.7–6.4% is the prediabetes range and 6.5% or higher suggests diabetes (confirmed with a repeat test).",
    source: "American Diabetes Association Standards of Care",
  },
  "FSH (day 3)": {
    what: "FSH is the hormone that tells the ovaries to grow a follicle.",
    context: "Measured early in the cycle, a higher FSH can mean the ovaries need more signal — one piece of ovarian reserve, read with AMH and age.",
    source: "ASRM",
    timing: "Meaningful on cycle days 2–4.",
  },
  "Estradiol (day 3)": {
    what: "Estradiol is the main estrogen of the reproductive years.",
    context: "Early in the cycle it should be low; a high early value can make FSH look falsely normal.",
    source: "ASRM",
    bioaro: "estradiol-e2",
    timing: "Read as a 'day 3' value only if drawn on cycle days 2–4.",
  },
  Progesterone: {
    what: "Progesterone rises after ovulation.",
    context: "About 7 days before your period, a level above roughly 3 ng/mL suggests you ovulated that cycle.",
    source: "ACOG · ASRM",
    bioaro: "progesterone",
    timing: "Only meaningful about 7 days before your next period.",
  },
  "Total testosterone": {
    what: "Testosterone is an androgen that women make in small amounts.",
    context: "A higher level is one of the signs looked at for PCOS, alongside cycles and ultrasound.",
    source: "International PCOS Guideline (2023)",
    bioaro: "testosterone",
  },
  "hs-CRP": {
    what: "hs-CRP measures low-grade inflammation.",
    context: "For heart risk: under 1 mg/L is low, 1–3 average, over 3 higher. A recent cold or injury can raise it, so one high value is usually repeated.",
    source: "AHA/CDC scientific statement (2003)",
    bioaro: "high-sensitive-crp-hs-crp",
  },
  "LDL cholesterol": {
    what: "LDL is the cholesterol that builds up in artery walls.",
    context: "Lower is better for heart health; your target depends on your overall risk.",
    source: "ACC/AHA cholesterol guideline (2018)",
  },
  Hemoglobin: {
    what: "Haemoglobin carries oxygen in your red blood cells.",
    context: "Below 120 g/L counts as anaemia in women who aren't pregnant.",
    source: "WHO haemoglobin thresholds (2024)",
  },
};

export interface SymptomInfo {
  about: string;
  helps: string[];
  see: string;
}

export const SYMPTOM_INFO: Record<string, SymptomInfo> = {
  Spotting: {
    about: "Light spotting around ovulation or in the first months on hormonal contraception is common. Bleeding between periods that keeps happening, or bleeding after sex, should be checked.",
    helps: ["Log the days it happens — the pattern matters", "Note if it follows sex, a new medicine or a missed pill"],
    see: "See a clinician if it happens over several cycles, after sex, after menopause, or with pain or a late period (pregnancy test first).",
  },
  "Cramps / pelvic pain": {
    about: "Period cramps come from prostaglandins that make the uterus contract. They're common — but pain that stops you from living normally isn't something to just accept.",
    helps: ["Heat on the lower belly", "Gentle movement", "Over-the-counter pain relief as the label or your pharmacist advises"],
    see: "See a clinician if pain stops you working or sleeping, gets worse over the years, or comes with pain during sex or bowel movements — these can be signs of endometriosis.",
  },
  "Pelvic pain": {
    about: "Pelvic pain around your period is common, but severe or worsening pain deserves a proper look.",
    helps: ["Heat", "Rest and gentle movement", "Pain relief as the label or your pharmacist advises"],
    see: "See a clinician if it disrupts your life, or comes with pain during sex or bowel movements.",
  },
  Headache: {
    about: "Headaches that cluster just before or at the start of your period are often linked to the drop in estrogen (menstrual migraine).",
    helps: ["Regular sleep and meals", "Water", "Noting the cycle day each time — it helps a clinician plan treatment"],
    see: "Get help urgently for the worst headache of your life, or a headache with weakness, confusion, fever and stiff neck, or vision loss.",
  },
  Bloating: {
    about: "Bloating is common in the days before a period, as hormones affect fluid and digestion.",
    helps: ["Smaller meals", "Less salt", "Movement"],
    see: "See a clinician if bloating is persistent most days for weeks, especially with feeling full quickly or pelvic pain.",
  },
  "Breast tenderness": {
    about: "Tender breasts before a period are usually from progesterone in the second half of the cycle.",
    helps: ["A supportive bra", "Warm or cool compresses"],
    see: "See a clinician for a new lump, skin or nipple changes, or pain in one spot that doesn't follow your cycle.",
  },
  Acne: {
    about: "Breakouts before a period are linked to hormone shifts; persistent acne with irregular cycles can be a sign of higher androgens (as in PCOS).",
    helps: ["A gentle routine", "Not picking"],
    see: "See a clinician if it's severe or comes with irregular periods or extra hair growth.",
  },
  "Painful bowel movements": {
    about: "Pain with bowel movements during your period can happen with endometriosis.",
    helps: ["Fibre and water", "Noting when it happens"],
    see: "Worth discussing with a clinician — especially with painful periods or pain during sex.",
  },
  "Pain with sex": {
    about: "Deep pain during sex is not something you have to accept; it can be linked to endometriosis and other treatable causes.",
    helps: ["Noting cycle day and position", "Talking with your partner"],
    see: "Worth raising with a gynaecologist.",
  },
  "Hot flash": {
    about: "Hot flashes are the most common sign of perimenopause and menopause.",
    helps: ["Layers", "A cooler bedroom", "Noting triggers like alcohol or spicy food"],
    see: "Effective treatments exist — a clinician can talk through options if they affect sleep or daily life.",
  },
  "Night sweats": {
    about: "Night sweats often come with perimenopause, but can have other causes.",
    helps: ["A cool bedroom", "Breathable bedding"],
    see: "See a clinician if they come with fever, weight loss, or you're not in midlife.",
  },
  Fatigue: {
    about: "Tiredness has many causes: short sleep, low iron, thyroid, mood, and the days around your period.",
    helps: ["Regular sleep times", "Checking iron and thyroid if it lasts"],
    see: "See a clinician if it lasts more than a few weeks or comes with breathlessness, weight change, or very heavy periods.",
  },
  Nausea: {
    about: "Some people feel nauseous around their period. If your period is late, nausea can also be early pregnancy.",
    helps: ["Small, plain meals", "Fluids"],
    see: "Get help if you can't keep fluids down or have severe pain.",
  },
  "Back pain": {
    about: "Lower back pain often comes with period cramps.",
    helps: ["Heat", "Gentle stretching"],
    see: "See a clinician for back pain with fever, numbness, or problems with bladder or bowel control.",
  },
};

export const PHASE_PLAIN: Record<string, string> = {
  menstrual: "your period — estrogen and progesterone are at their lowest",
  follicular: "the follicular phase — estrogen is rising as an egg matures",
  ovulatory: "around ovulation — a short window when an egg is released",
  luteal: "the luteal phase — progesterone is high, and it falls before your period",
};
