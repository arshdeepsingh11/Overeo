import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Offline" };

export default function Page() {
  return (
    <section className="ob">
      <div className="ob-card glass">
        <h1 className="ob-title">You're offline</h1>
        <p className="ob-sub">Your space still works — everything you log is saved on this device and nothing is lost.</p>
        <Link className="btn" href="/app">
          Open my space
        </Link>
      </div>
    </section>
  );
}
