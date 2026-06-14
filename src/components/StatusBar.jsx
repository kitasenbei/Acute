import { Box, Group, Text, Progress, ActionIcon, Stack } from '@mantine/core'
import { IconX, IconCheck, IconAlertTriangle } from '@tabler/icons-react'
import { useJobsStore } from '../stores/jobsStore.js'

/** Bottom status bar showing active/recent background jobs with progress. */
export function StatusBar() {
  const jobs = useJobsStore((s) => s.jobs)
  const dismiss = useJobsStore((s) => s.dismiss)
  if (!jobs.length) return null

  return (
    <Box
      px="md"
      py={6}
      style={{ borderTop: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }}
    >
      <Stack gap={4}>
        {jobs.map((j) => {
          const pct = Math.round((j.status === 'done' ? 1 : j.progress) * 100)
          const color = j.status === 'error' ? 'red' : j.status === 'done' ? 'teal' : 'blue'
          return (
            <Group key={j.id} gap="sm" wrap="nowrap">
              <Text size="xs" truncate style={{ flex: '0 0 220px' }} title={j.label}>
                {j.label}
              </Text>
              <Progress
                value={pct}
                color={color}
                size="sm"
                animated={j.status === 'running'}
                style={{ flex: 1 }}
              />
              <Box w={52} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                {j.status === 'running' ? (
                  <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {pct}%
                  </Text>
                ) : j.status === 'done' ? (
                  <IconCheck size={16} color="var(--mantine-color-teal-6)" />
                ) : (
                  <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
                )}
              </Box>
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => dismiss(j.id)}>
                <IconX size={14} />
              </ActionIcon>
            </Group>
          )
        })}
      </Stack>
    </Box>
  )
}
