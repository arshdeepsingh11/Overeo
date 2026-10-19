import type { IconName } from "../ui/Icon";

/* ------------------------------------------------------------------ *
 * Specialties — the ten areas of women's care OVEREO is a front door
 * to. Modelled on NEYU's specialty pages (Overview · Ask · Conditions ·
 * Tests & care · Tools · Visit), and written to be read by a patient:
 * what it is, when to act, how it's diagnosed, what care looks like,
 * and what OVEREO adds.
 *
 * Educational content, reviewed against the guidelines in `sources`.
 * It is not a diagnosis and never replaces a clinician.
 * ------------------------------------------------------------------ */

export interface Condition {
  id: string;
  name: string;
  summary: string;
  signs: string[];
  diagnosis: string[];
  care: string[];
  /** what OVEREO notices or adds for this condition */
  overeo: string;
  ask: string;
}

export interface Specialty {
  slug: string;
  name: string;
  short: string;
  tagline: string;
  icon: IconName;
  hue: number;
  /** ecosystem org ids; the first one leads */
  team: string[];
  about: string;
  whenToSee: string[];
  urgent?: string;
  symptoms: { label: string; ask: string }[];
  conditions: Condition[];
  /** test ids from content/tests.ts */
  tests: string[];
  /** tool tab ids from /tools */
  tools: string[];
  /** related silent-signal ids */
  signals: string[];
  path: { title: string; text: string }[];
  faqs: { q: string; a: string }[];
  sources: { label: string; url: string }[];
}

const PATH_DEFAULT = (team: string): Specialty["path"] => [
  { title: "Notice", text: "Your entries, wearables and labs are read together. Patterns surface on their own — you don't have to know what to ask." },
  { title: "Prepare", text: "Overeo SI turns the pattern into a one-page dossier: what was seen, for how long, and the questions worth asking." },
  { title: "Visit", text: `A clinician from ${team} sees you virtually or in clinic, with the dossier already in their record (BioEMR).` },
  { title: "Plan", text: "Tests are ordered only when they change a decision. Results flow back into your timeline and the plan updates." },
];

export const SPECIALTIES: Specialty[] = [
  /* ------------------------------------------------------------ */
  {
    slug: "fertility",
    name: "Fertility & egg freezing",
    short: "Fertility",
    tagline: "Know your timeline. Keep your options.",
    icon: "clock",
    hue: 330,
    team: ["neyu", "labs", "bio"],
    about:
      "Fertility care at OVEREO starts long before trying to conceive. It's about understanding your reproductive timeline — what ovarian-reserve markers can and cannot say — and making decisions like egg freezing with real numbers, not fear. Procedures such as egg retrieval are done with partner fertility clinics; everything around them (testing, timing, counselling, follow-up) stays in one place.",
    whenToSee: [
      "You're under 35 and have tried to conceive for 12 months, or 35+ and for 6 months",
      "Your cycles are shorter than 21 days, longer than 35 days, or unpredictable",
      "You're considering egg freezing and want to understand your numbers",
      "You have endometriosis, PCOS, prior pelvic surgery or cancer treatment ahead",
      "Early menopause runs in your family (mother or sister before 45)",
    ],
    symptoms: [
      { label: "What does my AMH mean?", ask: "What does AMH 1.3 mean?" },
      { label: "Should I freeze my eggs?", ask: "Should she think about egg freezing?" },
      { label: "Irregular cycles", ask: "Why are her cycles irregular?" },
      { label: "Trying for a year", ask: "When should I see a fertility doctor?" },
      { label: "Ovarian Clock", ask: "Explain her Ovarian Clock" },
    ],
    conditions: [
      {
        id: "dor",
        name: "Diminished ovarian reserve",
        summary: "A lower-than-expected number of eggs for age. It predicts how many eggs a stimulated cycle may yield — not whether you can conceive naturally.",
        signs: ["Usually no symptoms", "Sometimes shorter cycles as reserve falls", "Found on AMH, antral follicle count or day-3 FSH"],
        diagnosis: ["AMH (any cycle day)", "Antral follicle count by transvaginal ultrasound", "FSH and estradiol on cycle days 2–4"],
        care: ["Counselling on timeline and options", "Earlier referral if trying to conceive", "Egg or embryo freezing if family plans are later"],
        overeo: "The Ovarian Clock places your AMH against age-specific reference curves and keeps every result on the same assay over time, so a change is real and not lab-to-lab noise.",
        ask: "Can AMH predict natural fertility?",
      },
      {
        id: "egg-freezing",
        name: "Egg freezing (oocyte cryopreservation)",
        summary: "Stimulating the ovaries for ~10–14 days, then retrieving mature eggs to freeze. Outcomes depend mostly on age at freezing and number of eggs.",
        signs: ["Planning a family later", "Before treatment that can harm the ovaries", "Lower reserve for age"],
        diagnosis: ["AMH and antral follicle count to estimate likely egg yield", "Baseline bloodwork and infectious-disease screening required by clinics"],
        care: ["Consultation with a fertility specialist", "Stimulation and monitoring", "Retrieval at a partner clinic", "Storage and long-term follow-up"],
        overeo: "SI explains what your numbers mean for expected egg yield, prepares questions for the clinic, and times bloodwork to the right cycle days.",
        ask: "Should she think about egg freezing?",
      },
      {
        id: "anovulation",
        name: "Irregular ovulation",
        summary: "Ovulating rarely or unpredictably. Common causes include PCOS, thyroid disease, high prolactin, under-eating or over-training.",
        signs: ["Cycles under 21 or over 35 days", "Fewer than 8 periods a year", "No temperature rise in the second half of the cycle"],
        diagnosis: ["Mid-luteal progesterone (about 7 days before the expected period)", "TSH and prolactin", "Androgens if acne or excess hair"],
        care: ["Treat the cause", "Ovulation induction if trying to conceive", "Nutrition and energy-availability support"],
        overeo: "Wearable skin temperature shows a post-ovulation rise; when it's missing for a cycle, OVEREO notes it and suggests when a progesterone test would actually be informative.",
        ask: "How do you know if she ovulated?",
      },
    ],
    tests: ["amh", "fsh-e2", "progesterone", "tsh", "hormone-health", "ferritin-cbc"],
    tools: ["checkin"],
    signals: ["rhythm"],
    path: PATH_DEFAULT("NEYU fertility"),
    faqs: [
      { q: "Does a low AMH mean I can't get pregnant?", a: "No. AMH reflects how many eggs remain, which matters for IVF and egg freezing. Large studies have found it doesn't predict the chance of natural conception month to month for women not seeking treatment." },
      { q: "Can I test AMH on the pill?", a: "Yes, but hormonal contraception can lower AMH by roughly a fifth to a third. OVEREO records whether you were on it so the result is read in context." },
      { q: "What age is best for egg freezing?", a: "Outcomes are best when eggs are frozen younger, generally before the mid-30s, but the right time is personal. The number of eggs frozen and your age at freezing matter more than the age you use them." },
    ],
    sources: [
      { label: "ASRM — Practice guidance", url: "https://www.asrm.org/practice-guidance/" },
      { label: "Steiner et al., JAMA 2017 — ovarian reserve and natural fertility", url: "https://jamanetwork.com/journals/jama/fullarticle/2656809" },
      { label: "SOGC — Clinical practice guidelines", url: "https://sogc.org/" },
    ],
  },

  /* ------------------------------------------------------------ */
  {
    slug: "menstrual-health",
    name: "Menstrual health",
    short: "Periods",
    tagline: "Painful or heavy periods are information — not something to push through.",
    icon: "drop",
    hue: 345,
    team: ["neyu", "labs", "gut"],
    about:
      "Menstrual health covers period pain, heavy bleeding, irregular cycles and the conditions behind them — including endometriosis and adenomyosis, which are often diagnosed 7 to 11 years after symptoms begin. OVEREO's job is to make the pattern visible early and get you to the right clinician with evidence in hand.",
    whenToSee: [
      "Period pain that stops you working, studying or sleeping",
      "Bleeding through a pad or tampon every 1–2 hours, or clots larger than a coin",
      "Pain with sex, bowel movements or urination around your period",
      "Bleeding between periods or after sex",
      "Feeling exhausted or breathless with heavy periods",
    ],
    urgent: "Very heavy bleeding with dizziness or fainting, or severe sudden pelvic pain, needs urgent care — call 911 or go to an emergency department.",
    symptoms: [
      { label: "Painful periods", ask: "Is this endometriosis?" },
      { label: "Heavy bleeding", ask: "Why is she so tired?" },
      { label: "Pain with bowel movements", ask: "Tell me about endometriosis" },
      { label: "Irregular cycles", ask: "Why are her cycles irregular?" },
      { label: "Spotting between periods", ask: "When is spotting a concern?" },
    ],
    conditions: [
      {
        id: "endometriosis",
        name: "Endometriosis",
        summary: "Tissue similar to the uterine lining grows outside the uterus, causing inflammation, pain and sometimes fertility problems. It affects around 1 in 10 women of reproductive age.",
        signs: ["Period pain that's severe or worsening", "Deep pain during or after sex", "Cyclical bowel or bladder pain", "Fatigue", "Difficulty conceiving"],
        diagnosis: [
          "Symptoms alone are enough to start treatment — surgery is no longer required first",
          "Pelvic exam and transvaginal ultrasound (can show endometriomas and deep disease)",
          "MRI for suspected deep endometriosis",
          "Laparoscopy when imaging is normal but symptoms persist",
        ],
        care: ["Pain relief (NSAIDs)", "Hormonal treatment", "Excision surgery by a specialist when needed", "Pelvic physiotherapy and pain-management support"],
        overeo: "Silent Signals tracks how consistently pain, bowel symptoms and heavy flow cluster around your period across cycles — the exact pattern guidelines list as reasons to suspect endometriosis.",
        ask: "Is this endometriosis?",
      },
      {
        id: "hmb",
        name: "Heavy menstrual bleeding",
        summary: "Bleeding heavy enough to interfere with daily life. It drains iron stores month after month, often long before anaemia shows up.",
        signs: ["Changing protection every 1–2 hours", "Flooding or large clots", "Periods longer than 7 days", "Tiredness, breathlessness, hair shedding"],
        diagnosis: ["Full blood count for everyone with heavy bleeding", "Ferritin to see iron stores", "Ultrasound if fibroids or polyps are suspected", "Thyroid and clotting tests only if other signs point there"],
        care: ["Hormonal IUD, tranexamic acid or NSAIDs", "Iron replacement", "Treatment of fibroids or polyps", "Dietitian-led iron-rich nutrition"],
        overeo: "OVEREO links your flow logs to your ferritin trend. Maya's ferritin has fallen from 41 to 22 over 14 months — a pattern a single test would miss.",
        ask: "Why is she so tired?",
      },
      {
        id: "adenomyosis",
        name: "Adenomyosis",
        summary: "Endometrial tissue grows into the muscle wall of the uterus, causing heavy, painful periods and an enlarged, tender uterus.",
        signs: ["Heavy, prolonged periods", "Severe cramping", "Pelvic pressure", "Often in the late 30s and 40s"],
        diagnosis: ["Transvaginal ultrasound", "MRI"],
        care: ["Hormonal IUD", "NSAIDs and tranexamic acid", "Other hormonal treatment", "Surgery in selected cases"],
        overeo: "Logs of flow, pain and cycle length build the history a clinician needs to order the right imaging.",
        ask: "What is adenomyosis?",
      },
      {
        id: "pmdd",
        name: "PMS and PMDD",
        summary: "Physical and emotional symptoms in the 1–2 weeks before a period. PMDD is a severe form with major mood symptoms that lift once bleeding starts.",
        signs: ["Mood changes, irritability or anxiety before periods", "Sleep drops in the late luteal phase", "Bloating, breast tenderness", "Symptoms clear within days of bleeding"],
        diagnosis: ["Prospective daily symptom tracking for at least two cycles", "Ruling out other mood or thyroid conditions"],
        care: ["Lifestyle and sleep support", "SSRIs (can be taken in the luteal phase only)", "Hormonal options", "Psychological therapy"],
        overeo: "Because OVEREO dates each day to a cycle phase, it can show whether symptoms truly follow the luteal pattern — the core of a PMDD diagnosis.",
        ask: "Why does sleep drop before her period?",
      },
    ],
    tests: ["ferritin-cbc", "tsh", "pelvic-ultrasound", "hormone-health", "progesterone"],
    tools: ["pain", "checkin"],
    signals: ["endo", "iron", "luteal"],
    path: PATH_DEFAULT("NEYU gynaecology"),
    faqs: [
      { q: "Is period pain normal?", a: "Mild cramps are common. Pain that stops you from doing normal things, needs more than over-the-counter painkillers, or is getting worse is not something to accept — it's a reason to be assessed." },
      { q: "Do I need surgery to be diagnosed with endometriosis?", a: "Not to start treatment. Current European (ESHRE 2022) and UK (NICE) guidance supports diagnosis from symptoms and imaging, with laparoscopy reserved for when imaging is negative or treatment fails." },
      { q: "Why is ferritin checked and not just haemoglobin?", a: "Iron stores (ferritin) fall first. Haemoglobin often stays normal until the stores are almost empty, so ferritin catches the problem months earlier." },
    ],
    sources: [
      { label: "NICE NG73 — Endometriosis: diagnosis and management", url: "https://www.nice.org.uk/guidance/ng73" },
      { label: "ESHRE — Endometriosis guideline (2022)", url: "https://www.eshre.eu/Guidelines-and-Legal/Guidelines/Endometriosis-guideline" },
      { label: "NICE NG88 — Heavy menstrual bleeding", url: "https://www.nice.org.uk/guidance/ng88" },
    ],
  },

  /* ------------------------------------------------------------ */
  {
    slug: "hormones",
    name: "Hormones, PCOS & thyroid",
    short: "Hormones",
    tagline: "Hormones read in context — cycle day, contraception and all.",
    icon: "waves",
    hue: 300,
    team: ["acc", "labs", "gut"],
    about:
      "Hormone results mean little without context. Estradiol varies more than tenfold across a cycle; FSH is only interpretable on days 2–4; hormonal contraception changes almost everything. OVEREO times tests to your cycle and reads them against it. Endocrinology care — PCOS, thyroid, adrenal and metabolic conditions — is led by Advanced Cardiology's endocrinologists.",
    whenToSee: [
      "Cycles longer than 35 days or fewer than 8 periods a year",
      "Acne, excess facial or body hair, or scalp hair thinning",
      "Unexplained weight change, fatigue, feeling cold or hot",
      "A thyroid result outside range, or a family history of thyroid disease",
      "Planning pregnancy with a known thyroid condition",
    ],
    symptoms: [
      { label: "Irregular periods", ask: "Could she have PCOS?" },
      { label: "Acne before periods", ask: "Why does her skin break out before her period?" },
      { label: "Always tired", ask: "Why is she so tired?" },
      { label: "Thyroid results", ask: "What does TSH 2.1 mean?" },
      { label: "Hair thinning", ask: "What causes hair thinning in women?" },
    ],
    conditions: [
      {
        id: "pcos",
        name: "Polycystic ovary syndrome (PCOS)",
        summary: "The most common hormonal condition in women (around 1 in 8). It affects ovulation, skin and hair, and long-term metabolic and heart health.",
        signs: ["Irregular or absent periods", "Acne, excess hair growth, scalp hair loss", "Difficulty conceiving", "Higher risk of insulin resistance and type 2 diabetes"],
        diagnosis: [
          "2023 International Guideline (adults): two of three — irregular ovulation, high androgens (symptoms or blood tests), and polycystic ovaries on ultrasound or a high AMH",
          "Other causes ruled out first: thyroid, prolactin, non-classic CAH (17-OH progesterone)",
          "If periods are irregular and androgens are high, no ultrasound is needed",
        ],
        care: ["Lifestyle support without weight stigma", "Combined pill for cycles and skin", "Metformin for metabolic features", "Ovulation induction (letrozole) when trying to conceive", "Screening for diabetes, blood pressure and mood"],
        overeo: "The PCOS criteria tool fills in cycle irregularity from your own logs, then tells you exactly which blood tests would complete the picture — and which wouldn't.",
        ask: "Could she have PCOS?",
      },
      {
        id: "hypothyroid",
        name: "Hypothyroidism",
        summary: "An underactive thyroid, most often autoimmune (Hashimoto's). It's 5–8 times more common in women.",
        signs: ["Fatigue, feeling cold", "Weight gain", "Heavier or irregular periods", "Dry skin, hair loss", "Low mood"],
        diagnosis: ["TSH first; free T4 if TSH is abnormal", "Thyroid antibodies (TPO) in selected cases", "Repeat an abnormal result before treating"],
        care: ["Levothyroxine when indicated", "Tighter targets before and during pregnancy", "Recheck 6–8 weeks after dose changes"],
        overeo: "TSH sits on the same timeline as your cycle and energy logs, so a slow drift is visible before it crosses a range line.",
        ask: "What does TSH 2.1 mean?",
      },
      {
        id: "hyperthyroid",
        name: "Hyperthyroidism",
        summary: "An overactive thyroid (often Graves' disease) that speeds up metabolism.",
        signs: ["Racing heart, palpitations", "Weight loss, heat intolerance", "Anxiety, tremor", "Lighter or fewer periods"],
        diagnosis: ["Low TSH with high free T4/T3", "Thyroid antibodies and sometimes uptake scan"],
        care: ["Antithyroid medicines", "Radioactive iodine or surgery in some cases", "Beta-blockers for symptoms"],
        overeo: "Wearables flag a sustained rise in resting heart rate that doesn't follow your cycle — a useful nudge to check the thyroid.",
        ask: "Why is her resting heart rate rising?",
      },
      {
        id: "insulin",
        name: "Insulin resistance & prediabetes",
        summary: "The body needs more insulin to keep glucose normal. Common with PCOS and after gestational diabetes, and reversible early.",
        signs: ["Often silent", "Darker velvety skin in folds (acanthosis)", "Energy dips after meals", "Weight gain around the waist"],
        diagnosis: ["HbA1c or fasting glucose", "Oral glucose tolerance test for PCOS (the most sensitive test)"],
        care: ["Nutrition and strength training", "Metformin when indicated", "Regular rescreening"],
        overeo: "BioGut dietitians build plans on your microbiome and cycle; the Future Self simulator shows how the levers change your trajectory.",
        ask: "Simulate nutrition changes",
      },
    ],
    tests: ["androgens", "tsh", "hba1c-lipids", "hormone-health", "ultra-hormone", "prolactin", "amh"],
    tools: ["pcos", "checkin"],
    signals: ["rhythm"],
    path: PATH_DEFAULT("Advanced Cardiology endocrinology"),
    faqs: [
      { q: "Can I be tested for PCOS on the pill?", a: "Androgen and hormone results aren't reliable on hormonal contraception. Guidelines suggest stopping for about 3 months before testing, if that's safe and acceptable for you — talk to your clinician first." },
      { q: "Is AMH used to diagnose PCOS now?", a: "Yes, in adults. The 2023 International PCOS Guideline allows a high AMH instead of an ultrasound for the polycystic-ovary criterion, but not in adolescents." },
      { q: "Why does PCOS matter for the heart?", a: "PCOS raises the risk of insulin resistance, type 2 diabetes, high blood pressure and abnormal cholesterol, so guidelines recommend regular metabolic checks." },
    ],
    sources: [
      { label: "International Evidence-based Guideline for PCOS (2023)", url: "https://www.monash.edu/medicine/mchri/pcos/guideline" },
      { label: "Endocrine Society — Clinical practice guidelines", url: "https://www.endocrine.org/clinical-practice-guidelines" },
      { label: "American Thyroid Association", url: "https://www.thyroid.org/" },
    ],
  },

  /* ------------------------------------------------------------ */
  {
    slug: "menopause",
    name: "Perimenopause & menopause",
    short: "Menopause",
    tagline: "A transition you can plan for — not one to endure alone.",
    icon: "trend",
    hue: 22,
    team: ["neyu", "acc", "mynd", "bio"],
    about:
      "Perimenopause can start in the early 40s and last 4–8 years. Most midlife women with symptoms never seek care. OVEREO tracks the transition as it happens — cycle changes, sleep, temperature, mood — and connects you with clinicians who treat it, including menopausal hormone therapy when it's right for you. The years after menopause are when heart and bone risk rise, so the plan looks decades ahead.",
    whenToSee: [
      "Hot flushes, night sweats or sleep problems affecting your life",
      "Cycles changing in length by 7+ days, or skipped periods, in your 40s",
      "Low mood, anxiety or brain fog that's new",
      "Vaginal dryness, pain with sex or urinary symptoms",
      "Periods stopping before 40 (premature ovarian insufficiency) or before 45",
    ],
    urgent: "Any bleeding after menopause (12 months without a period) should be checked promptly.",
    symptoms: [
      { label: "Hot flushes", ask: "What happens after menopause?" },
      { label: "Night sweats & sleep", ask: "Why is her sleep getting worse?" },
      { label: "Brain fog", ask: "Is brain fog part of perimenopause?" },
      { label: "Is HRT safe?", ask: "Is hormone therapy safe?" },
      { label: "Am I in perimenopause?", ask: "How do I know if I'm in perimenopause?" },
    ],
    conditions: [
      {
        id: "perimenopause",
        name: "Perimenopause",
        summary: "The years before the final period, when hormone levels fluctuate widely. Diagnosis is usually based on symptoms and age — not a single blood test.",
        signs: ["Cycle length changes, skipped periods", "Hot flushes and night sweats", "Sleep disruption", "Mood changes, anxiety", "Heavier or lighter bleeding"],
        diagnosis: ["Over 45 with typical symptoms: no hormone test needed (NICE)", "FSH may help under 45, or 40–45 with atypical symptoms", "Exclude thyroid and other causes when unclear"],
        care: ["Menopausal hormone therapy when appropriate", "Non-hormonal options (e.g. fezolinetant, SSRIs/SNRIs, CBT)", "Sleep and strength-training support", "Contraception until periods have stopped long enough"],
        overeo: "The Menopause Rating Scale gives a validated baseline you can repeat. Cycle-length variability and temperature patterns show the transition starting, often years before the last period.",
        ask: "How do I know if I'm in perimenopause?",
      },
      {
        id: "poi",
        name: "Premature ovarian insufficiency",
        summary: "Loss of ovarian function before 40. It needs treatment, not just reassurance — mainly to protect bone and heart health.",
        signs: ["Periods stopping or becoming rare before 40", "Menopause-like symptoms", "Difficulty conceiving"],
        diagnosis: ["Raised FSH on two occasions 4–6 weeks apart", "Further tests for causes (genetic, autoimmune)"],
        care: ["Hormone replacement until at least the average age of menopause", "Bone density monitoring", "Fertility counselling"],
        overeo: "A sustained change in cycle rhythm before 40 is flagged early, with a route to NEYU and a cycle-timed FSH test.",
        ask: "What is premature ovarian insufficiency?",
      },
      {
        id: "gsm",
        name: "Genitourinary syndrome of menopause",
        summary: "Thinning and dryness of vaginal and urinary tissues as estrogen falls. Common, progressive — and very treatable.",
        signs: ["Vaginal dryness, burning or itching", "Pain with sex", "Urgency, recurrent urinary infections"],
        diagnosis: ["Clinical history and exam"],
        care: ["Vaginal moisturisers and lubricants", "Low-dose vaginal estrogen (safe for most women)", "Pelvic floor physiotherapy"],
        overeo: "SI can explain options privately and prepare the questions many women feel awkward raising.",
        ask: "What helps vaginal dryness after menopause?",
      },
    ],
    tests: ["fsh-e2", "tsh", "hba1c-lipids", "vitamin-d", "dxa", "hormone-health"],
    tools: ["mrs", "bone", "heart"],
    signals: ["peri", "luteal"],
    path: PATH_DEFAULT("NEYU menopause"),
    faqs: [
      { q: "Is hormone therapy safe?", a: "For most healthy women under 60 or within 10 years of menopause, the benefits of hormone therapy for symptoms generally outweigh the risks (The Menopause Society, 2022). The right choice depends on your history — that's a conversation with a clinician." },
      { q: "Can a blood test tell me if I'm in perimenopause?", a: "Usually not. Hormones swing so much during perimenopause that a single result can look normal. Over 45, guidelines recommend diagnosing from symptoms." },
      { q: "What about non-hormonal treatment?", a: "Options include fezolinetant (a newer non-hormonal medicine for hot flushes), some antidepressants, gabapentin and cognitive behavioural therapy." },
    ],
    sources: [
      { label: "NICE NG23 — Menopause: identification and management", url: "https://www.nice.org.uk/guidance/ng23" },
      { label: "The Menopause Society — 2022 hormone therapy position statement", url: "https://menopause.org/" },
      { label: "Mayo Clinic Proceedings (2025) — midlife women and care-seeking", url: "https://newsnetwork.mayoclinic.org/discussion/mayo-clinic-study-finds-majority-of-midlife-women-with-menopause-symptoms-do-not-seek-care" },
    ],
  },

  /* ------------------------------------------------------------ */
  {
    slug: "heart",
    name: "Women's heart health",
    short: "Heart",
    tagline: "Heart disease is the leading killer of women. It often looks different.",
    icon: "heart",
    hue: 350,
    team: ["acc", "bp", "labs"],
    about:
      "Women's heart symptoms are more often missed — they're more likely to include breathlessness, nausea, fatigue, or jaw, back or arm pain. Pregnancy complications, early menopause, PCOS and autoimmune disease are women-specific risk enhancers that standard calculators don't include. Advanced Cardiology leads women's heart care, with remote blood-pressure monitoring through the Hypertension Clinic.",
    whenToSee: [
      "Blood pressure readings above 130/80 at home",
      "A history of preeclampsia, gestational diabetes or high blood pressure in pregnancy",
      "Menopause before 40, PCOS, lupus or rheumatoid arthritis",
      "Heart disease in a father or brother before 55, or a mother or sister before 65",
      "Palpitations, breathlessness on exertion, or new exercise intolerance",
    ],
    urgent: "Chest pressure, breathlessness, cold sweat, nausea, or pain in the jaw, neck, back or arm — especially together — call 911 now. Don't drive yourself.",
    symptoms: [
      { label: "Chest discomfort", ask: "Tell me about women's heart health" },
      { label: "Palpitations", ask: "Why is her resting heart rate rising?" },
      { label: "High blood pressure", ask: "What blood pressure is too high?" },
      { label: "Pregnancy & the heart", ask: "How does preeclampsia affect heart risk?" },
      { label: "Heart after menopause", ask: "What happens after menopause?" },
    ],
    conditions: [
      {
        id: "cad",
        name: "Coronary & microvascular disease",
        summary: "Blocked large arteries, or dysfunction of the small vessels (more common in women), reducing blood flow to the heart.",
        signs: ["Chest pressure with exertion or stress", "Breathlessness, fatigue", "Pain in jaw, back or arm", "Symptoms with 'normal' angiograms (microvascular)"],
        diagnosis: ["ECG and stress testing", "Echocardiography", "CT coronary angiography", "Coronary function testing for microvascular disease"],
        care: ["Risk-factor treatment (BP, cholesterol, glucose)", "Medicines such as statins or antianginals", "Cardiac rehabilitation"],
        overeo: "The red-flag check routes urgent symptoms straight to emergency care; stable patterns go to Advanced Cardiology with your resting heart rate and HRV trends attached.",
        ask: "Tell me about women's heart health",
      },
      {
        id: "htn",
        name: "High blood pressure",
        summary: "The most common modifiable heart risk. It often rises after menopause and can start in pregnancy.",
        signs: ["Usually no symptoms", "Headaches only when very high"],
        diagnosis: ["Home or 24-hour ambulatory monitoring confirms clinic readings"],
        care: ["Salt, activity, sleep, alcohol", "Medication when indicated", "Remote monitoring with physician review"],
        overeo: "Home readings can stream in from the Hypertension Clinic's program; OVEREO shows them against your cycle and sleep.",
        ask: "What blood pressure is too high?",
      },
      {
        id: "scad",
        name: "SCAD & pregnancy-related heart conditions",
        summary: "Spontaneous coronary artery dissection mostly affects women under 50, including around pregnancy. Peripartum cardiomyopathy can appear late in pregnancy or after birth.",
        signs: ["Sudden chest pain, often in younger women with few risk factors", "Breathlessness or swelling around or after pregnancy"],
        diagnosis: ["Emergency assessment, coronary angiography", "Echocardiography"],
        care: ["Specialist cardiology care and rehabilitation"],
        overeo: "Pregnancy history is stored as a heart-risk factor for life — it shouldn't be forgotten after the baby arrives.",
        ask: "How does preeclampsia affect heart risk?",
      },
    ],
    tests: ["hba1c-lipids", "hs-crp", "cystatin-c", "core-inflammation", "lpa", "echo"],
    tools: ["heart", "checkin"],
    signals: ["cardiac"],
    path: PATH_DEFAULT("Advanced Cardiology"),
    faqs: [
      { q: "Why aren't pregnancy complications in my risk score?", a: "Most risk calculators were built on older data that didn't include them. Guidelines (e.g. ACC/AHA 2018–2019) now list preeclampsia and early menopause as 'risk enhancers' that should push toward earlier prevention." },
      { q: "Should I get Lp(a) tested?", a: "Lipoprotein(a) is largely genetic and only needs measuring once. The Canadian Cardiovascular Society recommends testing it once in every adult's lifetime." },
    ],
    sources: [
      { label: "AHA Go Red for Women", url: "https://www.goredforwomen.org/" },
      { label: "Canadian Cardiovascular Society — Dyslipidemia guidelines (2021)", url: "https://ccs.ca/guidelines-and-clinical-practice-updates/" },
      { label: "Hypertension Canada", url: "https://hypertension.ca/" },
    ],
  },

  /* ------------------------------------------------------------ */
  {
    slug: "bone",
    name: "Bone & metabolic health",
    short: "Bone",
    tagline: "Bone is built until your 30s — and protected for the rest of your life.",
    icon: "shield",
    hue: 35,
    team: ["acc", "sport", "gut"],
    about:
      "Women lose bone fastest in the years around menopause, and one in three women will have an osteoporotic fracture. Most of what protects bone — strength training, protein, calcium, vitamin D, not smoking — works best started early. OVEREO keeps your bone risk factors in one place and knows when a bone-density scan is actually recommended.",
    whenToSee: [
      "A fracture from a fall at standing height after 40",
      "Menopause before 45, or periods stopping for months (e.g. from under-eating or over-training)",
      "Long-term steroid use, rheumatoid arthritis, coeliac disease or other malabsorption",
      "A parent who broke a hip",
      "Losing height or a stooped posture",
    ],
    symptoms: [
      { label: "Bone density scan — when?", ask: "When should she get a bone density scan?" },
      { label: "Strength training", ask: "What if she starts strength training?" },
      { label: "Vitamin D", ask: "Does she need vitamin D testing?" },
      { label: "Missed periods & bone", ask: "Can missed periods affect bones?" },
    ],
    conditions: [
      {
        id: "osteoporosis",
        name: "Osteoporosis & osteopenia",
        summary: "Bones become less dense and more fragile. There are no symptoms until a fracture.",
        signs: ["Fracture from minor trauma", "Height loss", "Back pain from vertebral fractures"],
        diagnosis: ["DXA bone density scan", "Fracture risk (e.g. FRAX) combining risk factors and density", "Bloodwork for secondary causes"],
        care: ["Strength and balance training", "Calcium and vitamin D from diet first", "Medicines (e.g. bisphosphonates) when fracture risk is high"],
        overeo: "The bone tool gathers the factors fracture calculators use, and Future Self shows how strength training shifts the curve after 40.",
        ask: "When should she get a bone density scan?",
      },
      {
        id: "reds",
        name: "Low energy availability (RED-S)",
        summary: "Not eating enough for the training you do. It can stop periods and weaken bones, and is common in active women.",
        signs: ["Missed or stopped periods", "Stress fractures", "Fatigue, frequent illness"],
        diagnosis: ["History of training and nutrition", "Hormone tests to exclude other causes", "DXA if periods have stopped for months"],
        care: ["Dietitian-led fuelling plan", "Adjusted training load", "Monitoring for return of periods"],
        overeo: "BioSport syncs training to your cycle; a disappearing post-ovulation temperature rise is an early sign worth acting on.",
        ask: "Can missed periods affect bones?",
      },
    ],
    tests: ["dxa", "vitamin-d", "essential-vitamins", "tsh", "hba1c-lipids"],
    tools: ["bone"],
    signals: [],
    path: PATH_DEFAULT("Advanced Cardiology endocrinology"),
    faqs: [
      { q: "When is a bone density scan recommended?", a: "Screening is generally recommended for women 65 and older (Osteoporosis Canada, USPSTF), and earlier for those with risk factors such as a fragility fracture after 40, early menopause, long-term steroid use or conditions that affect bone." },
      { q: "Do I need a vitamin D blood test?", a: "Not routinely. The Endocrine Society's 2024 guideline advises against routine vitamin D testing in healthy adults under 75. Testing makes sense when you have bone disease, malabsorption, or a previous low result being followed up." },
    ],
    sources: [
      { label: "Osteoporosis Canada — Clinical practice guideline (2023)", url: "https://osteoporosis.ca/" },
      { label: "FRAX fracture risk tool", url: "https://frax.shef.ac.uk/FRAX/" },
      { label: "Endocrine Society — Vitamin D guideline (2024)", url: "https://www.endocrine.org/clinical-practice-guidelines/vitamin-d-for-prevention-of-disease" },
    ],
  },

  /* ------------------------------------------------------------ */
  {
    slug: "skin",
    name: "Skin, hair & hormones",
    short: "Skin",
    tagline: "Skin from the inside — hormones, gut and microbiome together.",
    icon: "sparkle",
    hue: 15,
    team: ["nea", "labs", "gut"],
    about:
      "Skin changes are often the most visible sign of what hormones are doing: breakouts before a period, acne and hair growth with PCOS, dryness and thinning after menopause. NEA Precision Skin combines dermatology with gut and skin microbiome testing and hormone-aware care, so treatment follows the cause rather than just the surface.",
    whenToSee: [
      "Acne that flares before periods or appears in adulthood",
      "New excess facial or body hair, or scalp hair thinning",
      "Skin changes that started with a new contraceptive or after pregnancy",
      "Rosacea, eczema or sensitivity that tracks with your cycle or gut symptoms",
      "A changing mole — see a clinician promptly",
    ],
    symptoms: [
      { label: "Breakouts before periods", ask: "Why does her skin break out before her period?" },
      { label: "Hair thinning", ask: "What causes hair thinning in women?" },
      { label: "Skin & gut", ask: "How is gut health linked to skin?" },
      { label: "Skin after menopause", ask: "How does menopause change skin?" },
    ],
    conditions: [
      {
        id: "hormonal-acne",
        name: "Hormonal acne",
        summary: "Acne driven by androgen activity, often along the jaw and chin and worse in the days before a period.",
        signs: ["Deep, tender spots on the lower face", "Flares in the late luteal phase", "Persistent beyond the teens"],
        diagnosis: ["Clinical assessment", "Androgen tests if periods are irregular or there's excess hair (to look for PCOS)"],
        care: ["Topical retinoids and benzoyl peroxide", "Combined pill or spironolactone (not in pregnancy)", "Isotretinoin for severe cases"],
        overeo: "Because your logs are dated by phase, OVEREO can show whether breakouts truly cluster before periods — and suggest timing skin care accordingly.",
        ask: "Why does her skin break out before her period?",
      },
      {
        id: "hair-loss",
        name: "Female-pattern hair loss",
        summary: "Gradual thinning over the crown, influenced by genetics and hormones. Iron, thyroid and recent stress or pregnancy can add to it.",
        signs: ["Widening part", "More scalp visible", "Increased shedding after illness or birth (telogen effluvium)"],
        diagnosis: ["Scalp exam", "Ferritin, thyroid, and androgen tests where relevant"],
        care: ["Topical or oral minoxidil", "Treating low iron or thyroid issues", "Anti-androgen options in selected cases"],
        overeo: "Hair shedding plus falling ferritin and heavy periods is one connected story — OVEREO shows it as one.",
        ask: "What causes hair thinning in women?",
      },
      {
        id: "skin-aging",
        name: "Skin changes in midlife",
        summary: "Collagen falls sharply in the first years after menopause, bringing dryness, thinning and slower healing.",
        signs: ["Dryness and sensitivity", "Loss of firmness", "Slower wound healing"],
        diagnosis: ["Clinical assessment"],
        care: ["Daily sunscreen, retinoids, moisturisers", "Menopausal hormone therapy may help skin as part of broader care", "Nutrition and sleep"],
        overeo: "NEA's plan is linked to your menopause timeline, so skin care changes as your hormones do.",
        ask: "How does menopause change skin?",
      },
    ],
    tests: ["bioskin", "androgens", "ferritin-cbc", "biogut", "tsh"],
    tools: ["checkin", "pcos"],
    signals: ["rhythm"],
    path: PATH_DEFAULT("NEA"),
    faqs: [
      { q: "Will a skin microbiome test tell me what's wrong?", a: "Not on its own. Skin microbiome profiling is an emerging science — it can help personalise a care plan with a clinician, but it isn't a diagnostic test for acne or eczema." },
      { q: "Is spironolactone safe?", a: "It's widely used for hormonal acne in women, but must not be used in pregnancy, so it's paired with reliable contraception. Your clinician will check it suits you." },
    ],
    sources: [
      { label: "American Academy of Dermatology — Acne guidelines", url: "https://www.aad.org/member/clinical-quality/guidelines/acne" },
      { label: "NEA Precision Skin", url: "https://www.neaskincare.com/" },
      { label: "BioAro Labs — Skin microbiome and skin health", url: "https://bioarolabs.com/learn/skin-microbiome-aging-skin-health" },
    ],
  },

  /* ------------------------------------------------------------ */
  {
    slug: "gut",
    name: "Gut, microbiome & nutrition",
    short: "Gut",
    tagline: "Your microbiome, your cycle and your plate — one plan.",
    icon: "target",
    hue: 40,
    team: ["gut", "nea", "labs"],
    about:
      "Gut symptoms often change across the cycle — prostaglandins around a period can cause cramping and loose stools, and progesterone slows digestion in the luteal phase. BioGut registered dietitians build nutrition plans around your microbiome, iron needs and cycle; NEA offers gut, skin and vaginal microbiome testing.",
    whenToSee: [
      "Bloating, pain or bowel changes most weeks",
      "Bowel pain that's worst with your period (also an endometriosis feature)",
      "Low iron despite eating well",
      "A restrictive or plant-based diet you want to get right",
      "Unintended weight loss, blood in stool, or night-time symptoms — see a clinician promptly",
    ],
    urgent: "Blood in your stool, black stools, unexplained weight loss or persistent vomiting need prompt medical assessment.",
    symptoms: [
      { label: "Bloating before periods", ask: "Why does she bloat before her period?" },
      { label: "Iron-rich eating", ask: "Simulate iron treatment" },
      { label: "Microbiome", ask: "What does her microbiome show?" },
      { label: "Gut & skin", ask: "How is gut health linked to skin?" },
    ],
    conditions: [
      {
        id: "ibs",
        name: "Irritable bowel syndrome",
        summary: "Recurring abdominal pain with changes in bowel habit, more common in women and often worse around periods.",
        signs: ["Pain linked to bowel movements", "Bloating", "Constipation, diarrhoea or both"],
        diagnosis: ["Symptom-based (Rome IV)", "Coeliac screen and blood count to exclude other causes", "Alarm features prompt further tests"],
        care: ["Dietitian-led low-FODMAP approach", "Fibre and gut-directed therapy", "Medicines for specific symptoms"],
        overeo: "Logging bowel symptoms by cycle phase separates IBS-type patterns from the cyclical bowel pain that can point to endometriosis.",
        ask: "Why does she bloat before her period?",
      },
      {
        id: "iron-def",
        name: "Iron deficiency",
        summary: "The most common nutrient deficiency in women, mostly from menstrual loss. Fatigue, poor focus and hair shedding can appear before anaemia.",
        signs: ["Fatigue, breathlessness", "Restless legs", "Hair shedding", "Craving ice"],
        diagnosis: ["Ferritin and full blood count", "Coeliac screen if iron doesn't respond"],
        care: ["Iron supplements (alternate-day dosing can absorb better)", "IV iron when needed", "Treat heavy bleeding as the source"],
        overeo: "Ferritin trends, flow logs and energy scores sit on one timeline; the Future Self iron lever shows the expected effect.",
        ask: "Why is she so tired?",
      },
      {
        id: "coeliac",
        name: "Coeliac disease",
        summary: "An autoimmune reaction to gluten, more common in women. It can cause iron deficiency, bone loss and fertility problems.",
        signs: ["Bloating, diarrhoea, or no gut symptoms at all", "Unexplained iron deficiency", "Fatigue"],
        diagnosis: ["tTG-IgA blood test while still eating gluten", "Confirmed by endoscopy"],
        care: ["Strict gluten-free diet with dietitian support"],
        overeo: "Iron that doesn't recover despite supplements is a cue OVEREO raises for a coeliac screen.",
        ask: "Why isn't her iron improving?",
      },
    ],
    tests: ["biogut", "ferritin-cbc", "essential-vitamins", "celiac"],
    tools: ["checkin", "pain"],
    signals: ["iron"],
    path: PATH_DEFAULT("BioGut"),
    faqs: [
      { q: "Can a microbiome test diagnose my gut problem?", a: "No. Stool microbiome tests describe which microbes are present. They can help a dietitian personalise a plan, but they don't diagnose conditions like IBS or coeliac disease — those have their own tests." },
      { q: "Should I go gluten-free before testing?", a: "No — coeliac blood tests need you to be eating gluten, otherwise they can come back falsely normal." },
    ],
    sources: [
      { label: "Rome Foundation — Rome IV criteria", url: "https://theromefoundation.org/" },
      { label: "BioAro Labs — Gut microbiome and longevity", url: "https://bioarolabs.com/learn/gut-microbiome-and-longevity" },
      { label: "Canadian Celiac Association", url: "https://www.celiac.ca/" },
    ],
  },

  /* ------------------------------------------------------------ */
  {
    slug: "mind-sleep",
    name: "Mind & sleep",
    short: "Mind",
    tagline: "Sleep and mood that follow your cycle — and support that does too.",
    icon: "moon",
    hue: 265,
    team: ["mynd", "neyu"],
    about:
      "Sleep often drops in the days before a period, and in perimenopause night sweats break it up further. Mood conditions are more common in women and can be shaped by hormonal shifts — before periods, after birth and through the menopause transition. BioMynd offers cycle-timed sleep and mental-health support, alongside NEYU physicians.",
    whenToSee: [
      "Trouble falling or staying asleep 3+ nights a week for 3 months",
      "Low mood, anxiety or irritability that follows your cycle",
      "Loud snoring or pauses in breathing (sleep apnoea risk rises after menopause)",
      "Low mood or anxiety in pregnancy or after birth",
    ],
    urgent: "If you're thinking about harming yourself, call or text 988 (Canada & US) or go to an emergency department now.",
    symptoms: [
      { label: "Sleep drops before periods", ask: "Why does sleep drop before her period?" },
      { label: "Mood before periods", ask: "What is PMDD?" },
      { label: "Night sweats", ask: "Why is her sleep getting worse?" },
      { label: "Brain fog", ask: "Is brain fog part of perimenopause?" },
    ],
    conditions: [
      {
        id: "insomnia",
        name: "Insomnia",
        summary: "Difficulty sleeping despite the opportunity to, affecting daytime life. Cognitive behavioural therapy for insomnia (CBT-I) is the first-line treatment.",
        signs: ["Long time to fall asleep", "Waking in the night or too early", "Daytime fatigue, poor focus"],
        diagnosis: ["Sleep history and diary", "Screening for apnoea, mood and hormonal causes"],
        care: ["CBT-I", "Treating night sweats if present", "Short-term medicines in selected cases"],
        overeo: "Wearable sleep is read by cycle phase. Maya loses about 50 minutes in the five days before her period — a timed pattern, so support can be timed too.",
        ask: "Why does sleep drop before her period?",
      },
      {
        id: "pmdd-mind",
        name: "PMDD",
        summary: "Severe mood symptoms in the luteal phase that resolve after bleeding starts. It's a recognised condition, not 'just PMS'.",
        signs: ["Marked mood swings, irritability, low mood or anxiety before periods", "Relief within a few days of bleeding"],
        diagnosis: ["Daily ratings across at least two cycles"],
        care: ["SSRIs (continuous or luteal-only)", "Hormonal options", "Psychological support"],
        overeo: "OVEREO's check-in records mood alongside cycle phase, building the prospective record PMDD diagnosis requires.",
        ask: "What is PMDD?",
      },
      {
        id: "perinatal",
        name: "Perinatal mood & anxiety",
        summary: "Depression and anxiety during pregnancy or in the year after birth affect around 1 in 5 women, and are treatable.",
        signs: ["Persistent low mood, anxiety or intrusive thoughts", "Not enjoying things", "Sleep or appetite changes beyond a newborn's demands"],
        diagnosis: ["Screening (e.g. EPDS) and clinical assessment"],
        care: ["Therapy", "Medicines compatible with pregnancy and breastfeeding", "Peer support"],
        overeo: "Check-ins continue through pregnancy and postpartum; SI surfaces support early, without judgement.",
        ask: "What is postpartum depression?",
      },
    ],
    tests: ["tsh", "ferritin-cbc", "sleep-study"],
    tools: ["checkin", "mrs"],
    signals: ["luteal", "peri"],
    path: PATH_DEFAULT("BioMynd"),
    faqs: [
      { q: "Is a cortisol test useful for stress or burnout?", a: "Generally not. A single cortisol value swings through the day and doesn't measure 'stress'. Cortisol testing is for specific conditions like Cushing's or Addison's, ordered by a clinician." },
      { q: "Why does sleep change across my cycle?", a: "Progesterone raises body temperature after ovulation and falls sharply before a period; both can affect sleep quality, especially in the late luteal days." },
    ],
    sources: [
      { label: "American Academy of Sleep Medicine", url: "https://aasm.org/" },
      { label: "International Association for Premenstrual Disorders", url: "https://iapmd.org/" },
      { label: "988 Suicide Crisis Helpline (Canada)", url: "https://988.ca/" },
    ],
  },

  /* ------------------------------------------------------------ */
  {
    slug: "longevity",
    name: "Longevity & genomics",
    short: "Longevity",
    tagline: "A female layer for your digital twin — with evidence grades on everything.",
    icon: "dna",
    hue: 280,
    team: ["bio", "labs", "drugs"],
    about:
      "Longevity medicine aims to extend the years you live in good health. Biongevity builds your digital twin; OVEREO adds the female layer — reproductive timeline, cycle, menopause — that most longevity models leave out. Genomics and advanced biomarkers come from BioAro Labs, with every test graded by how strong its evidence is, so you know what's established and what's still research.",
    whenToSee: [
      "A family history of early heart disease, cancer, dementia or early menopause",
      "You want a structured prevention plan for the next 30 years",
      "Medicines that haven't worked or caused side effects (pharmacogenomics)",
      "Considering genetic testing and want counselling first",
    ],
    symptoms: [
      { label: "Biological age", ask: "What is biological age?" },
      { label: "Genome testing", ask: "How is genetic data handled?" },
      { label: "Drug side effects", ask: "Why do women get more drug side effects?" },
      { label: "Future Self", ask: "What if she starts strength training?" },
    ],
    conditions: [
      {
        id: "hereditary",
        name: "Hereditary cancer risk (e.g. BRCA)",
        summary: "Some inherited variants greatly raise breast and ovarian cancer risk. Knowing changes screening and prevention.",
        signs: ["Breast cancer in close relatives under 50", "Ovarian cancer in the family", "Male breast cancer", "Ashkenazi Jewish ancestry"],
        diagnosis: ["Genetic counselling, then targeted or panel testing", "Whole-genome results need careful, consented interpretation"],
        care: ["Enhanced screening (MRI)", "Risk-reducing options", "Testing for relatives"],
        overeo: "Genetic results stay off until you switch them on, one use at a time — and a counsellor explains them before you see them.",
        ask: "How is genetic data handled?",
      },
      {
        id: "pgx",
        name: "Medicine response (pharmacogenomics)",
        summary: "Genes like CYP2C19 and CYP2D6 change how you process certain medicines. Women experience adverse drug reactions nearly twice as often as men.",
        signs: ["Side effects at standard doses", "Medicines that don't work", "Starting medicines with known gene interactions"],
        diagnosis: ["Pharmacogenomic panel; interpreted with CPIC guidelines"],
        care: ["Dose or drug choice guided by genotype", "Results reused for life"],
        overeo: "Maya's CYP2C19 intermediate-metaboliser result is checked by BioAro Drugs before any protocol is suggested.",
        ask: "Why do women get more drug side effects?",
      },
      {
        id: "healthspan",
        name: "Healthspan & biological age",
        summary: "Biological-age clocks and inflammation markers estimate how fast you're ageing. They're promising — but still better for research and tracking than for decisions.",
        signs: ["No symptoms — this is prevention"],
        diagnosis: ["Established: blood pressure, lipids, HbA1c, fitness, strength", "Emerging: epigenetic clocks, inflammation panels, GDF-15"],
        care: ["Strength, fitness, sleep, nutrition — the levers with the best evidence", "Track, don't over-treat, emerging markers"],
        overeo: "Future Self compares two trajectories and shows which levers move them; every input is labelled established or emerging.",
        ask: "What is biological age?",
      },
    ],
    tests: ["pgx", "wgs", "core-inflammation", "hs-crp", "gdf15", "telomere", "brain-health", "cfdna"],
    tools: ["heart", "bone"],
    signals: [],
    path: PATH_DEFAULT("Biongevity"),
    faqs: [
      { q: "Should I get a brain-health (p-tau217) test?", a: "Not without symptoms. Blood biomarkers for Alzheimer's are currently recommended for people with memory symptoms being assessed by specialists, not for screening healthy adults." },
      { q: "Is telomere length useful?", a: "It's an interesting research measure, but it varies between labs and doesn't yet guide individual decisions. OVEREO marks it as exploratory." },
      { q: "Can cell-free DNA tests screen for cancer?", a: "Multi-cancer detection blood tests are still being evaluated. BioAro's comprehensive cfDNA test is prescription-only and used in cancer care and monitoring — not as a screening test for healthy people." },
    ],
    sources: [
      { label: "CPIC — Clinical Pharmacogenetics Implementation Consortium", url: "https://cpicpgx.org/" },
      { label: "Zucker & Prendergast, Biology of Sex Differences (2020)", url: "https://bsd.biomedcentral.com/articles/10.1186/s13293-020-00308-5" },
      { label: "BioAro Labs — Biological age vs chronological age", url: "https://bioarolabs.com/learn/biological-age-vs-chronological" },
    ],
  },
];

export const specialtyBySlug = (slug: string) => SPECIALTIES.find((s) => s.slug === slug);
