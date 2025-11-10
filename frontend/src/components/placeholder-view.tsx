interface PlaceholderViewProps {
  title: string
}

export default function PlaceholderView({ title }: PlaceholderViewProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <h1 className="text-3xl font-semibold text-text-primary">{title}</h1>
    </div>
  )
}



