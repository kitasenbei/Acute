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

export function SidebarItem({ icon: Icon, dot, label, active, onClick, onUnpin }) {
  const [hover, setHover] = useState(false)
  return (
    <Flex
      align="center"
      gap="xs"
      px="sm"
      py={6}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 8,
        cursor: 'pointer',
        background: active || hover ? 'var(--mantine-color-default-hover)' : 'transparent',
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
