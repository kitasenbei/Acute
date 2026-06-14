import { Group, Text, UnstyledButton, ActionIcon } from '@mantine/core'
import { IconHome, IconChevronRight } from '@tabler/icons-react'

export function Breadcrumbs({ path, onNavigate }) {
  const segments = path ? path.split('/') : []
  return (
    <Group gap={4} wrap="nowrap" style={{ overflow: 'hidden' }}>
      <ActionIcon variant="subtle" color="gray" onClick={() => onNavigate('')}>
        <IconHome size={16} />
      </ActionIcon>
      {segments.map((seg, i) => {
        const target = segments.slice(0, i + 1).join('/')
        const last = i === segments.length - 1
        return (
          <Group gap={4} key={target} wrap="nowrap">
            <IconChevronRight size={14} color="var(--mantine-color-dimmed)" />
            <UnstyledButton onClick={() => !last && onNavigate(target)}>
              <Text size="sm" c={last ? undefined : 'dimmed'} fw={last ? 600 : 400} truncate>
                {seg}
              </Text>
            </UnstyledButton>
          </Group>
        )
      })}
    </Group>
  )
}
