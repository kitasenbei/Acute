import { Box, Group, Text, Progress, ActionIcon, Stack, Divider } from '@mantine/core'
import { IconX, IconCheck, IconAlertTriangle } from '@tabler/icons-react'
import { useJobsStore } from '../stores/jobsStore.js'
import { formatBytes } from '../util.js'

/**
 * Persistent bottom status bar: a summary of the current view (item / selection
 * counts + free disk space) plus rows for any active background jobs.
 */
export function StatusBar({ summary, usage }) {
  const jobs = useJobsStore((s) => s.jobs)
  const dismiss = useJobsStore((s) => s.dismiss)

  const left =
    summary.selectedCount > 0
      ? `${summary.selectedCount} selected${summary.selectedSize ? ` · ${formatBytes(summary.selectedSize)}` : ''}`
      : `${summary.items} ${summary.items === 1 ? 'item' : 'items'}`

  return (
    <Box px="md" py={6} style={{ borderTop: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }}>
      {jobs.length > 0 && (
        <>
          <Stack gap={4} mb={6}>
            {jobs.map((j) => {
              const pct = Math.round((j.status === 'done' ? 1 : j.progress) * 100)
              const color = j.status === 'error' ? 'red' : j.status === 'done' ? 'teal' : 'blue'
              return (
                <Group key={j.id} gap="sm" wrap="nowrap">
                  <Text size="xs" truncate style={{ flex: '0 0 220px' }} title={j.label}>
                    {j.label}
                  </Text>
                  <Progress value={pct} color={color} size="sm" animated={j.status === 'running'} style={{ flex: 1 }} />
                  <Box w={52} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {j.status === 'running' ? (
                      <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>{pct}%</Text>
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
          <Divider mb={6} />
        </>
      )}

      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Text size="xs" c="dimmed">{left}</Text>
        {usage && (
          <Text size="xs" c="dimmed">
            {formatBytes(usage.free)} free
          </Text>
        )}
      </Group>
    </Box>
  )
}
