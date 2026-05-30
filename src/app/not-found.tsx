import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-5xl">🔑</div>
      <h1 className="text-2xl font-extrabold text-navy">This link isn&apos;t right</h1>
      <p className="text-burgundy">
        Check the personal link Rory sent you — it&apos;s the key to your app.
      </p>
      <Link href="/" className="font-bold text-amber-deep underline">
        Go to start
      </Link>
    </main>
  );
}
