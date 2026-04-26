import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export function App() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
  });

  return (
    <main className="container mx-auto py-12 space-y-6">
      <h1 className="text-3xl font-bold">📰 Multi-Agent Newsroom</h1>
      <p className="text-muted-foreground">
        Production-ready scaffold: Vite + React + TS + TanStack + shadcn/ui + Vitest + Biome.
      </p>
      <section className="rounded-lg border p-4">
        <h2 className="font-semibold mb-2">Backend health</h2>
        {isLoading && <p>Checking…</p>}
        {error && <p className="text-destructive">Backend unreachable</p>}
        {data && <p>Status: {data.status}</p>}
      </section>
      <Button>Get started</Button>
    </main>
  );
}
