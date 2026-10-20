import { useEffect, useId, useRef, useState } from 'react'

export type SelectOption = { value: string; label: string; disabled?: boolean }

type Props = {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  className?: string
  triggerClassName?: string
  disabled?: boolean
  placeholder?: string
  'aria-label'?: string
}

export function Select({ value, options, onChange, className, triggerClassName, disabled, placeholder, 'aria-label': label }: Props) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)

  function place() {
    const t = trigger.current?.getBoundingClientRect()
    const m = menu.current
    if (!t || !m) return
    const below = window.innerHeight - t.bottom - 12
    const above = t.top - 12
    const up = below < Math.min(m.scrollHeight, 240) && above > below
    m.style.minWidth = `${t.width}px`
    m.style.maxHeight = `${Math.max(120, up ? above : below)}px`
    m.style.left = `${Math.max(8, Math.min(t.left, window.innerWidth - m.offsetWidth - 8))}px`
    m.style.top = up ? `${Math.max(8, t.top - 4 - Math.min(m.scrollHeight, above))}px` : `${t.bottom + 4}px`
    const start = m.querySelector<HTMLElement>('[aria-selected="true"]:not(:disabled)') ?? m.querySelector<HTMLElement>('button:not(:disabled)')
    start?.scrollIntoView({ block: 'nearest' })
    start?.focus({ preventScroll: true })
  }

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => !menu.current?.contains(e.target as Node) && menu.current?.hidePopover()
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        ref={trigger}
        className={triggerClassName ?? `adm-input adm-select ${className ?? ''}`}
        popoverTarget={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span className="adm-select-value">{current?.label ?? placeholder ?? ''}</span>
      </button>
      <div
        id={id}
        ref={menu}
        popover="auto"
        role="listbox"
        aria-label={label}
        className="adm-select-menu"
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          const items = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)')]
          const at = items.indexOf(document.activeElement as HTMLElement)
          items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
        }}
        onToggle={(e) => {
          const isOpen = e.newState === 'open'
          setOpen(isOpen)
          if (isOpen) place()
        }}
      >
        {options.map((o) => (
          <button
            type="button"
            role="option"
            key={o.value}
            aria-selected={o.value === value}
            disabled={o.disabled}
            className="adm-select-option"
            onClick={() => {
              menu.current?.hidePopover()
              if (o.value !== value) onChange(o.value)
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </>
  )
}
