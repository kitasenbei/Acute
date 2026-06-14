import { Menu, ColorSwatch } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import { useContextMenuStore } from '../stores/contextMenuStore.js'

function leftSectionFor(item) {
  if (item.dot) return <ColorSwatch color={item.dot} size={12} />
  const Icon = item.icon
  return Icon ? <Icon size={16} /> : null
}

/** Render a list of menu items, recursing into nested submenus. */
function renderItems(items, close) {
  return items.map((item, i) => {
    if (item.divider) return <Menu.Divider key={`divider-${i}`} />

    // Native Mantine v8 submenu.
    if (item.submenu) {
      return (
        <Menu.Sub key={item.label}>
          <Menu.Sub.Target>
            <Menu.Sub.Item leftSection={leftSectionFor(item)}>{item.label}</Menu.Sub.Item>
          </Menu.Sub.Target>
          <Menu.Sub.Dropdown>{renderItems(item.submenu, close)}</Menu.Sub.Dropdown>
        </Menu.Sub>
      )
    }

    return (
      <Menu.Item
        key={item.label}
        color={item.color}
        leftSection={leftSectionFor(item)}
        rightSection={item.checked ? <IconCheck size={14} /> : null}
        onClick={() => {
          close()
          item.onClick?.()
        }}
      >
        {item.label}
      </Menu.Item>
    )
  })
}

/**
 * Renders the shared context menu at the stored cursor position. Anchors a
 * Mantine Menu to an invisible zero-size target placed at (x, y).
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
      <Menu.Dropdown style={{ maxHeight: '70vh', overflowY: 'auto' }}>{renderItems(items, close)}</Menu.Dropdown>
    </Menu>
  )
}
