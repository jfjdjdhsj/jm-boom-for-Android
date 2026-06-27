import { useMemo } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { SignInRecord } from '@/lib/api/user'
import { cn } from '@/lib/utils'

import { buildSignInCalendar } from './sign-in-utils'

export function SignInCalendar({ records }: { records: SignInRecord[] }) {
  const { weeks } = useMemo(() => buildSignInCalendar(records), [records])

  return (
    <div className="min-w-0 pb-1">
      <div className="flex w-max max-w-full gap-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-rows-7 gap-1">
            {week.map((day, dayIndex) =>
              day ? (
                <Tooltip key={day.isoDate}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'size-3 rounded-[2px] border border-border/60 bg-muted/30 transition-colors outline-none',
                        day.hasRecord && 'bg-muted/70',
                        day.signed && 'border-emerald-500/60 bg-emerald-500',
                        day.bonus && 'border-yellow-400'
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>{day.tooltip}</TooltipContent>
                </Tooltip>
              ) : (
                <div key={`empty-${weekIndex}-${dayIndex}`} className="size-3 rounded-[2px]" />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
