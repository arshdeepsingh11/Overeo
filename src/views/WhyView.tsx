"use client";

import Link from "next/link";
import { useState } from "react";
import { Page, PageHero, SectionTitle, Callout } from "../ui/Page";
import { Icon, type IconName } from "../ui/Icon";
import { openSI } from "../core/store";
import { RESEARCH } from "../content/research-facts";
import { SPECIALISTS, teamById, type TeamAgent } from "../agents/team";
import { Avatar } from "./app/team/Avatar";
import { EchoSwitch } from "../translate/Echo";

/* =====================================================================
   Why OVEREO — the page that explains everything in plain words:
   what OVEREO is, why it matters (with checked research), how it
   works, who her agents are and how to turn them on, privacy, and
   questions people ask. Written for someone who has never used a
   health app before.
   ===================================================================== */

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "plus", title: "Note how you feel", text: "Tap to log your period, a symptom, your mood or sleep. It takes a few seconds. You can also add a lab report as a photo or PDF." },
  { icon: "sparkle", title: "OVEREO learns your pattern", text: "On your own phone, OVEREO connects the dots — for example, that your headaches come two days before your period, or that your mood follows your sleep." },
  { icon: "doc", title: "You get clear next steps", text: "Plain answers, gentle reminders, and a one-page summary to show your doctor — so you're heard sooner." },
];

const IS: [IconName, string][] = [
  ["heart", "A women's health companion for periods, hormones, fertility, pregnancy planning, menopause, mood, sleep and heart health."],
  ["eye", "It explains your own patterns in everyday words, and always shows why it says something."],
  ["users", "It helps you get the right care: what to ask, which kind of doctor, and which tests are actually useful."],
];
const ISNT: [IconName, string][] = [
  ["shield", "It is not a doctor and never diagnoses. It helps you have a better conversation with one."],
  ["pill", "It never tells you to start or stop a medicine, or how much to take."],
  ["cart", "It doesn't push tests. A test is suggested only when the science and your data say it's useful."],
];

const PRIVACY: [IconName, string][] = [
  ["phone", "Your space lives on your device. The sample person (Maya) is kept completely separate from you."],
  ["lock", "Lock OVEREO with a PIN, and use discreet mode to hide health words on screen."],
  ["eyeoff", "When the live brain helps, only short facts about your patterns are shared — never your name, email or entries. You can switch this off."],
  ["download", "Download everything as a file, or delete your space completely, any time, in Me."],
];

const FAQ: [string, string][] = [
  ["Is OVEREO a doctor?", "No. OVEREO is educational. It explains, organises and reminds — and helps you prepare for your doctor. In an emergency, call your local emergency number."],
  ["Do I need a smartwatch or other device?", "No. Everything works by simply tapping to log. Nothing else to buy or wear."],
  ["What do the agents actually do?", "Each one has one job — like tracking your cycle, explaining lab results or reminding you. They only suggest; nothing happens until you say yes, and everything they do is written in your Diary."],
  ["Can I turn an agent off?", "Yes. Go to My space → Agents and switch any agent off or on. You can also choose how often it may suggest something, and quiet hours."],
  ["What if I ask a question that isn't in OVEREO's knowledge?", "The agents say so honestly — they're built to say \"That isn't in what I know yet\" rather than guess. A checker (ORA) removes any number it can't find in OVEREO's sources."],
  ["Does it work in my language?", "Yes. Choose your language in Me, and turn on ECHO to translate any word, sentence or whole page into 28 languages."],
  ["Does it work without internet?", "Your own data, your patterns and most answers work on your device. The live brain and some translations need internet."],
  ["Where do the facts come from?", "From OVEREO's guides and from major health bodies such as the World Health Organization, the CDC, ASRM, the American Heart Association and FIGO. Every fact links to its source."],
];

export function WhyView() {
  const [all, setAll] = useState(false);
  const facts = all ? RESEARCH : RESEARCH.slice(0, 6);
  const helpers = ["ora", "si"].map((id) => teamById(id)!);
  const echo = teamById("echo")!;

  return (
    <Page id="why">
      <PageHero
        aside={<TeamOrbit />}
        eyebrow="Why OVEREO"
        title={
          <>
            Understand your body. <span className="serif grad-text">Get the right care sooner.</span>
          </>
        }
        lede="OVEREO turns what you notice — your periods, symptoms, mood, sleep and lab results — into clear answers in plain words, with a small team of helpers who each do one job well."
      >
        <div className="hero-ctas why-ctas">
          <Link className="btn" href="/app">
            <Icon name="user" size={16} /> Start my space
          </Link>
          <button className="btn ghost" onClick={() => openSI("What is OVEREO and how can it help me?")}>
            <Icon name="sparkle" size={16} /> Ask a question
          </button>
        </div>
        <div className="why-echo glass" style={{ ["--h" as string]: echo.hue }}>
          <Avatar agent={echo} size={44} label={false} />
          <div>
            <b>Prefer another language?</b>
            <span className="faint small">Turn on ECHO, then tap its button to read this page in your language.</span>
          </div>
          <EchoSwitch compact />
        </div>
      </PageHero>

      <section className="wrap why-sec" aria-labelledby="why-what">
        <SectionTitle kicker="In one minute" title={<span id="why-what">What OVEREO is — and isn't</span>} />
        <div className="why-two">
          <div className="glass why-list why-yes">
            <h3>What it is</h3>
            <ul>
              {IS.map(([ic, t]) => (
                <li key={t}>
                  <Icon name={ic} size={16} /> <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="glass why-list">
            <h3>What it isn't</h3>
            <ul>
              {ISNT.map(([ic, t]) => (
                <li key={t}>
                  <Icon name={ic} size={16} /> <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="wrap why-sec" aria-labelledby="why-matters">
        <SectionTitle kicker="Why it matters" title={<span id="why-matters">Women's health is too often missed</span>}>
          These are checked facts from major health organisations — and what OVEREO does about each one.
        </SectionTitle>
        <div className="why-facts">
          {facts.map((f) => (
            <article key={f.id} className="glass why-fact">
              <b className="why-stat">{f.stat}</b>
              <h3>{f.title}</h3>
              <p className="small">{f.text.split(/(?<=\.)\s/)[0]}</p>
              <p className="small why-help">
                <Icon name="sparkle" size={12} /> {f.help}
              </p>
              <a className="src-chip" href={f.url} target="_blank" rel="noopener noreferrer">
                {f.source.split(" — ")[0]} <Icon name="external" size={10} />
              </a>
            </article>
          ))}
        </div>
        {!all && (
          <button className="btn ghost sm why-more" onClick={() => setAll(true)}>
            Show all {RESEARCH.length} facts <Icon name="down" size={14} />
          </button>
        )}
      </section>

      <section className="wrap why-sec" aria-labelledby="why-how">
        <SectionTitle kicker="How it works" title={<span id="why-how">Three simple steps</span>} />
        <ol className="why-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="glass">
              <span className="why-num">{i + 1}</span>
              <Icon name={s.icon} size={20} />
              <h3>{s.title}</h3>
              <p className="small">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap why-sec" aria-labelledby="why-team">
        <SectionTitle kicker="Meet your team" title={<span id="why-team">Your helpers — each with one job</span>}>
          Ask any question and the right helper answers. If your question belongs to someone else, they hand it over.
        </SectionTitle>
        <div className="why-team">
          {SPECIALISTS.map((a) => (
            <TeamCard key={a.id} a={a} />
          ))}
          <TeamCard a={echo} note="Turn on below or in Me" />
          {helpers.map((a) => (
            <TeamCard key={a.id} a={a} note="Always on — works behind the scenes" />
          ))}
        </div>
      </section>

      <section className="wrap why-sec" aria-labelledby="why-on">
        <SectionTitle kicker="Turning them on" title={<span id="why-on">How to switch your agents on</span>} />
        <div className="why-two">
          <ol className="glass why-howto">
            <li>
              <b>Open your space.</b> Tap <Link href="/app">Start my space</Link> and choose your goals (it takes a minute).
            </li>
            <li>
              <b>Go to Agents.</b> In the menu, tap <Link href="/app/agents">Agents</Link>. The helpers that fit your goals are already on.
            </li>
            <li>
              <b>Switch any helper on or off.</b> Tap a helper to choose what it may do, what it must never do, how often it can suggest something, and quiet hours.
            </li>
            <li>
              <b>Talk to them.</b> Tap <b>Chat</b> on any helper, or <Link href="/app/team">Ask the team</Link> to have several work on one question together.
            </li>
          </ol>
          <div className="glass why-echo-box" style={{ ["--h" as string]: echo.hue }}>
            <div className="why-echo-head">
              <Avatar agent={echo} size={56} label={false} />
              <div>
                <b>ECHO — your translator</b>
                <span className="faint small">{echo.role}</span>
              </div>
            </div>
            <EchoSwitch />
            <ul className="small">
              <li>Whole page: tap the ECHO button (bottom left), then “Translate this page”.</li>
              <li>One word or sentence: select it, then tap “Translate”. You can listen to it or copy it.</li>
              <li>Numbers are never changed. Tap “Show the original” any time.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="wrap why-sec" aria-labelledby="why-privacy">
        <SectionTitle kicker="Your privacy" title={<span id="why-privacy">Your data stays yours</span>} />
        <div className="why-privacy">
          {PRIVACY.map(([ic, t]) => (
            <div key={t} className="glass">
              <Icon name={ic} size={18} />
              <p className="small">{t}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap why-sec" aria-labelledby="why-faq">
        <SectionTitle kicker="Questions" title={<span id="why-faq">Questions people ask</span>} />
        <div className="why-faq">
          {FAQ.map(([q, a]) => (
            <details key={q} className="glass">
              <summary>{q}</summary>
              <p className="small">{a}</p>
            </details>
          ))}
        </div>
        <Callout tone="alert" title="In an emergency">
          Chest pain, trouble breathing, signs of stroke, fainting, very heavy bleeding, severe sudden pain or thoughts of self-harm — call your local emergency number now. In Canada and the US, 988 reaches a suicide crisis line.
        </Callout>
      </section>

      <section className="wrap why-sec why-end">
        <h2 className="title-md">Ready when you are.</h2>
        <p className="muted">Start with one thing — log today's mood or your last period. OVEREO does the rest.</p>
        <div className="hero-ctas why-ctas">
          <Link className="btn" href="/app">
            <Icon name="user" size={16} /> Start my space
          </Link>
          <Link className="btn ghost" href="/">
            <Icon name="home" size={16} /> Back to home
          </Link>
        </div>
      </section>
    </Page>
  );
}

/** the team, floating together — the hero picture */
function TeamOrbit() {
  return (
    <div className="why-orbit" aria-label="Your OVEREO team">
      {SPECIALISTS.map((a, i) => (
        <span key={a.id} className="why-orbit-i" style={{ ["--i" as string]: i, ["--h" as string]: a.hue }}>
          <Avatar agent={a} size={78} label={false} />
          <b>{a.name}</b>
        </span>
      ))}
    </div>
  );
}

function TeamCard({ a, note }: { a: TeamAgent; note?: string }) {
  return (
    <article className="glass why-agent" style={{ ["--h" as string]: a.hue }}>
      <Avatar agent={a} size={76} label={false} />
      <div>
        <h3>
          {a.name} <span className="faint small">· {a.title}</span>
        </h3>
        <p className="small">{a.role}</p>
        {a.starters[0] && <p className="why-ask small">You can ask: “{a.starters[0]}”</p>}
        {note && <span className="faint small">{note}</span>}
      </div>
    </article>
  );
}
