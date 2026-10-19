import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <header className="page-hero wrap">
        <div className="page-hero-copy">
          <span className="eyebrow">
            <span className="dot" /> 404
          </span>
          <h1 className="title-lg page-title">This page isn&apos;t part of OVEREO — yet.</h1>
          <p className="lede">Press O and ask Overeo SI where to go, or head back to the hub.</p>
          <p>
            <Link className="btn" href="/">
              Back to the hub
            </Link>
          </p>
        </div>
      </header>
    </div>
  );
}
