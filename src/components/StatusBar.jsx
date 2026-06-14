import { Box, Group, Text, Progress, ActionIcon } from '@mantine/core'
import { IconX, IconCheck, IconAlertTriangle } from '@tabler/icons-react'
import { useJobsStore } from '../stores/jobsStore.js'
import { formatBytes } from '../util.js'

function JobInline({ job, onDismiss }) {
  const pct = Math.round((job.status === 'done' ? 1 : job.progress) * 100)
  const color = job.status === 'error' ? 'red' : job.status === 'done' ? 'teal' : 'blue'
  return (
    <Group gap={8} wrap="nowrap">
      <Text size="xs" c="dimmed" truncate style={{ maxWidth: 160 }} title={job.label}>
        {job.label}
      </Text>
      <Progress value={pct} color={color} size="sm" w={110} animated={job.status === 'running'} />
      {job.status === 'running' ? (
        <Text size="xs" c="dimmed" w={32} ta="right" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {pct}%
        </Text>
      ) : job.status === 'done' ? (
        <IconCheck size={15} color="var(--mantine-color-teal-6)" />
      ) : (
        <IconAlertTriangle size={15} color="var(--mantine-color-red-6)" />
      )}
      <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => onDismiss(job.id)}>
        <IconX size={13} />
      </ActionIcon>
    </Group>
  )
}

/** Persistent single-line bottom status bar: summary + inline jobs + free space. */
export function StatusBar({ summary, usage }) {
  const jobs = useJobsStore((s) => s.jobs)
  const dismiss = useJobsStore((s) => s.dismiss)

  const left =
    summary.selectedCount > 0
      ? `${summary.selectedCount} selected${summary.selectedSize ? ` · ${formatBytes(summary.selectedSize)}` : ''}`
      : `${summary.items} ${summary.items === 1 ? 'item' : 'items'}`

  return (
    <Box px="md" py={5} style={{ borderTop: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }}>
      <Group justify="space-between" gap="lg" wrap="nowrap">
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
          {left}
        </Text>

        <Group gap="lg" wrap="nowrap" style={{ flex: 1, justifyContent: 'flex-end', overflow: 'hidden' }}>
          {jobs.map((job) => (
            <JobInline key={job.id} job={job} onDismiss={dismiss} />
          ))}
        </Group>

        {usage && (
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            {formatBytes(usage.free)} free
          </Text>
        )}
      </Group>
    </Box>
  )
}
