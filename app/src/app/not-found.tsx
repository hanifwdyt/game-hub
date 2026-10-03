import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-hub"><h1>That game isn’t here</h1>
      <p>It may have moved back to development or been renamed.</p><Link href="/" className="play-btn"><span>Back to the hub</span></Link></main>
  );
}
