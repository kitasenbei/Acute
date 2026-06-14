import { useState } from 'react'
import { Flex, Text, ColorSwatch, ActionIcon } from '@mantine/core'
import { IconStarFilled } from '@tabler/icons-react'

/** A plain group heading for the sidebar (replaces dividers). */
export function SidebarLabel({ children, first }) {
  return (
    <Text size="xs" c="dimmed" px="sm" mt={first ? 4 : 12} mb={4}>
      {children}
    </Text>
  )
}

export function SidebarItem({ icon: Icon, dot, label, active, onClick, onUnpin, dropPath, onDropInto }) {
  const [hover, setHover] = useState(false)
  const [dropOver, setDropOver] = useState(false)
  const canDrop = dropPath != null && onDropInto
  const dropProps = canDrop
    ? {
        onDragOver: (e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDropOver(true)
        },
        onDragLeave: () => setDropOver(false),
        onDrop: (e) => {
          e.preventDefault()
          setDropOver(false)
          onDropInto(dropPath)
        },
      }
    : {}
  return (
    <Flex
      align="center"
      gap="xs"
      px="sm"
      py={6}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...dropProps}
      style={{
        borderRadius: 8,
        cursor: 'pointer',
        outline: dropOver ? '2px solid var(--mantine-primary-color-filled)' : undefined,
        outlineOffset: -2,
        background: dropOver || active || hover ? 'var(--mantine-color-default-hover)' : 'transparent',
      }}
    >
      {dot ? (
        <ColorSwatch color={dot} size={11} style={{ marginLeft: 3, marginRight: 3 }} />
      ) : (
        <Icon size={17} color="var(--mantine-color-dimmed)" />
      )}
      <Text size="sm" truncate style={{ flex: 1 }}>
        {label}
      </Text>
      {onUnpin && hover && (
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={(e) => { e.stopPropagation(); onUnpin() }}>
          <IconStarFilled size={13} />
        </ActionIcon>
      )}
    </Flex>
  )
}
