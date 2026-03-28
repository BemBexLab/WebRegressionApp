import AddWebsite from "@/components/AddWebsite";

export default function ResultsPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6 md:p-10">
      <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
        Monitoring Results
      </h1>
      <p className="max-w-3xl text-sm text-slate-600 md:text-base">
        Enter a URL and review scan results with realtime history.
      </p>
      <AddWebsite />
    </main>
  );
}
