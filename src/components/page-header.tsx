import { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  desc: string
  children?: ReactNode
}

export function PageHeader({ title, desc, children }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </header>
  )
}
