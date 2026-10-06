import { Button } from '@/components/ui/button'
import { useHealth } from '@/features/health/use-health'

export function HomePage() {
  const health = useHealth()

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-semibold">ShopKH</h1>
      <p className="mt-2 text-muted-foreground">Phase 0: project setup</p>

      <div className="mt-8 rounded-md border border-border p-4">
        {health.isPending && <p>Checking API…</p>}
        {health.isError && <p className="text-red-600">API unreachable: {health.error.message}</p>}
        {health.isSuccess && (
          <p>
            API status: <strong data-testid="api-status">{health.data.status}</strong>
            <span className="ml-2 text-sm text-muted-foreground">({health.data.time})</span>
          </p>
        )}
        <Button className="mt-4" variant="outline" size="sm" onClick={() => health.refetch()}>
          Refresh
        </Button>
      </div>
    </main>
  )
}
