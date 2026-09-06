import { cn } from '@/lib/utils'

export function Card({
  className, children, ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('glass rounded-card', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-label-tertiary">
        {title}
      </h2>
      {action}
    </div>
  )
}
