import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";

interface ComingSoonPageProps {
  title: string;
}

export default function ComingSoonPage({ title }: ComingSoonPageProps) {
  return (
    <MainLayout title={title}>
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="bg-secondary/50 p-6 rounded-full mb-6">
          <span className="text-4xl">🚧</span>
        </div>
        <h2 className="text-2xl font-heading font-semibold mb-2">Coming Soon</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          We are working hard to bring you this feature. Stay tuned for updates!
        </p>
        <Button variant="outline" onClick={() => window.history.back()}>
          Go Back
        </Button>
      </div>
    </MainLayout>
  );
}
