"use client";

import { useStore, clearToolResult } from "../core/store";
import { PageHero, Disclaimer } from "../ui/Page";
import { Icon } from "../ui/Icon";
import { TabbedPage, Panel } from "./TabbedPage";
import { CheckIn } from "../tools/CheckIn";
import { PainMap } from "../tools/PainMap";
import { PcosCriteria } from "../tools/PcosCriteria";
import { MenopauseScale } from "../tools/MenopauseScale";
import { HeartCheck } from "../tools/HeartCheck";
import { BoneCheck } from "../tools/BoneCheck";

/* /tools — guided check-ins and validated questionnaires. Every result
   is saved to the same profile, so the Test Navigator, Silent Signals,
   the dossier and Overeo SI all know about it. */

export function ToolsView({ initialTab }: { initialTab?: string }) {
  const results = useStore((s) => s.toolResults);
  const done = Object.values(results).sort((a, b) => b.at - a.at);
  const wrap = (node: React.ReactNode) => (
    <Panel>
      {node}
      <Disclaimer />
    </Panel>
  );
  return (
    <TabbedPage
      routeId="tools"
      initialTab={initialTab}
      hero={
        <PageHero
          eyebrow="Tools"
          title={
            <>
              Tell OVEREO a little. <span className="serif grad-text">Get a lot back.</span>
            </>
          }
          lede="Guided tools built on clinical guidelines and validated questionnaires. Each takes a minute or two, and everything you enter sharpens your tests, signals and dossier."
          aside={
            <div className="glass tool-ledger">
              <span className="faint small upper">Your results</span>
              {done.length ? (
                <ul>
                  {done.map((r) => (
                    <li key={r.tool}>
                      <span className={`sig-dot ${r.level === "urgent" ? "urgent" : r.level === "high" ? "strong" : r.level === "moderate" ? "emerging" : "watch"}`} />
                      <span>
                        <b className="small">{r.title}</b>
                        <span className="faint small">{r.summary}</span>
                      </span>
                      <button className="icon-btn" aria-label={`Clear ${r.title}`} onClick={() => clearToolResult(r.tool)}>
                        <Icon name="close" size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">Nothing yet. Start with today's check-in — it takes 30 seconds.</p>
              )}
            </div>
          }
        />
      }
      narration={{
        checkin: "Every check-in rewrites today's entry; Silent Signals and the forecast recompute instantly.",
        pain: "The pain map turns where and when it hurts into the features clinicians look for.",
        pcos: "I've pre-filled the cycle criterion from her own logs.",
        mrs: "The MRS is validated — repeat it every few months to see change.",
        heart: "Red flags first. Then the risk enhancers most calculators miss in women.",
        bone: "Bone banked before menopause lasts for decades.",
      }}
      panels={{
        checkin: () => wrap(<CheckIn />),
        pain: () => wrap(<PainMap />),
        pcos: () => wrap(<PcosCriteria />),
        mrs: () => wrap(<MenopauseScale />),
        heart: () => wrap(<HeartCheck />),
        bone: () => wrap(<BoneCheck />),
      }}
    />
  );
}
