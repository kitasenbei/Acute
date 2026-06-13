import { Menu } from '@mantine/core'
import { useContextMenuStore } from '../stores/contextMenuStore.js'

/**
 * Renders the shared context menu at the stored cursor position. Anchors a
 * Mantine Menu to an invisible zero-size target placed at (x, y), so we get
 * Mantine's positioning + click-outside handling for free.
 */
export function ContextMenu() {
  const opened = useContextMenuStore((s) => s.opened)
  const x = useContextMenuStore((s) => s.x)
  const y = useContextMenuStore((s) => s.y)
  const items = useContextMenuStore((s) => s.items)
  const close = useContextMenuStore((s) => s.close)

  return (
    <Menu opened={opened} onClose={close} position="bottom-start" offset={2} shadow="md" width={210} withinPortal>
      <Menu.Target>
        <div style={{ position: 'fixed', left: x, top: y, width: 0, height: 0 }} />
      </Menu.Target>
      <Menu.Dropdown>
        {items.map((item, i) => {
          if (item.divider) return <Menu.Divider key={`divider-${i}`} />
          const Icon = item.icon
          return (
            <Menu.Item
              key={item.label}
              color={item.color}
              leftSection={Icon ? <Icon size={16} /> : null}
              onClick={() => {
                close()
                item.onClick?.()
              }}
            >
              {item.label}
            </Menu.Item>
          )
        })}
      </Menu.Dropdown>
    </Menu>
  )
}
