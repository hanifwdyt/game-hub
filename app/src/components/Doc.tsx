import Link from "next/link";

/** Plain readable page (privacy, credits) in the hub's console look: slanted header, one column, no card chrome. */
export function Doc({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <main className="doc">
      <header className="doc-head"><div className="acct-kick">{kicker}</div><h1>{title}</h1></header>
      <div className="doc-body">{children}</div>
      <Link href="/" className="doc-back">← Back to games</Link>
    </main>
  );
}
