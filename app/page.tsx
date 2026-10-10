// Placeholder home. P2 replaces this with the resident map (R1).
import Link from "next/link";
export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">RoadWatch</h1>
      <p className="mt-2 text-sm text-ink/70">Resident map goes here (P2).</p>
      <Link className="btn-primary mt-4" href="/login">Department login</Link>
    </main>
  );
}
