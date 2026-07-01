import { Settings2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useSettingsStore } from '@/stores/settings-store'

const READER_SETTING_BUTTON_CLASS =
  'h-7 rounded-md px-2 text-xs text-neutral-200 hover:bg-white/10 hover:text-neutral-50 focus-visible:text-neutral-50'

const READER_SETTING_ITEM_CLASS =
  'text-neutral-100 focus:bg-white/10 focus:text-neutral-50 [&_svg]:text-neutral-300'

export function ReaderSettingsMenu() {
  const readerReadMode = useSettingsStore(state => state.readerReadMode)
  const readerDoublePageMode = useSettingsStore(state => state.readerDoublePageMode)
  const setReaderReadMode = useSettingsStore(state => state.setReaderReadMode)
  const setReaderDoublePageMode = useSettingsStore(state => state.setReaderDoublePageMode)
  const canUseDoublePage = readerReadMode === 'single'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="xs" className={READER_SETTING_BUTTON_CLASS}>
          <Settings2Icon className="size-3.5" />
          阅读设置
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-56 border border-white/10 bg-neutral-950/95 text-neutral-50 shadow-2xl backdrop-blur-xl"
      >
        <DropdownMenuLabel className="text-neutral-400">阅读模式</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={readerReadMode} onValueChange={setReaderReadMode}>
          <DropdownMenuRadioItem value="single" className={READER_SETTING_ITEM_CLASS}>
            单页
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="strip" className={READER_SETTING_ITEM_CLASS}>
            竖向阅读
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuCheckboxItem
          checked={readerDoublePageMode}
          disabled={!canUseDoublePage}
          className={READER_SETTING_ITEM_CLASS}
          onCheckedChange={checked => setReaderDoublePageMode(checked === true)}
        >
          双页阅读
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <div className="px-3 py-2 text-xs leading-5 text-neutral-400">
          竖向阅读会纵向连续显示当前章节图片；双页阅读仅在单页模式中生效。
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
