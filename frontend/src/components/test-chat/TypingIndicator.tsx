interface TypingIndicatorProps {
  label?: string
}

export function TypingIndicator({ label = "Agent" }: TypingIndicatorProps) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-xs font-semibold text-blue-600">{label}</span>
      <div className="mt-1 flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 shadow-sm">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 animate-bounce rounded-full bg-text-secondary [animation-delay:-0.3s]"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-text-secondary [animation-delay:-0.15s]"></div>
          <div className="h-2 w-2 animate-bounce rounded-full bg-text-secondary"></div>
        </div>
      </div>
    </div>
  )
}
