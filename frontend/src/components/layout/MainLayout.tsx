import React from "react";
// import { Toaster } from "@/components/ui/toaster";

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function MainLayout({ children, title, subtitle, actions }: MainLayoutProps) {
  return (
    <div className="h-full w-full overflow-y-auto relative">
      {/* Sticky Header with Separator Line */}
      {(title || subtitle || actions) && (
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/60 px-6 lg:px-10 py-4 flex items-center justify-between h-20">
          <div>
            {title && <h1 className="text-xl font-heading font-semibold tracking-tight text-foreground">{title}</h1>}
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>
      )}

      <div className="relative z-10 p-6 lg:p-10 max-w-[1600px] mx-auto">
        {children}
      </div>
    </div>
  );
}
