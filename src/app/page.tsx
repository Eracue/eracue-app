import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-light tracking-tight text-neutral-900 mb-4">ERA CUE</h1>
        <p className="text-lg text-neutral-600 mb-12">The record that proves someone checked.</p>
        <div className="flex gap-4 justify-center">
          <Link href="/submit" className="px-6 py-3 bg-neutral-900 text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition">Submit a draft</Link>
          <Link href="/drafts" className="px-6 py-3 bg-white border border-neutral-300 text-neutral-900 text-sm font-medium rounded-md hover:bg-neutral-50 transition">View drafts</Link>
        </div>
      </div>
    </main>
  );
}
