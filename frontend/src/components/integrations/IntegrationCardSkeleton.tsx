import { Card } from "../ui/card"
import { Skeleton } from "../ui/skeleton"

export function IntegrationCardSkeleton() {
  return (
    <Card className="p-6 space-y-4" data-testid="integration-card-skeleton">
      <div className="flex items-start justify-between">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-8 w-24" />
    </Card>
  )
}
