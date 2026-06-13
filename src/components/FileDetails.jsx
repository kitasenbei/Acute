import { Box, Stack, Text, Divider } from '@mantine/core'
import { formatBytes, formatDateTime } from '../util.js'
import { kindLabel } from '../fileTypes.js'

/** A labelled metadata field. */
function Field({ label, value }) {
  return (
    <Box>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" style={{ wordBreak: 'break-word' }}>
        {value}
      </Text>
    </Box>
  )
}

/** Parent folder of a root-relative path, or 'Home' when at the top level. */
function locationOf(path) {
  if (!path.includes('/')) return 'Home'
  return path.slice(0, path.lastIndexOf('/'))
}

function SingleDetails({ entry }) {
  const fields = [
    ['Name', entry.name],
    ['Kind', kindLabel(entry)],
    entry.type === 'file' && ['Size', formatBytes(entry.size)],
    ['Modified', formatDateTime(entry.modifiedAt)],
    ['Location', locationOf(entry.path)],
  ].filter(Boolean)

  return (
    <Stack gap="md">
      {fields.map(([label, value]) => (
        <Field key={label} label={label} value={value} />
      ))}
    </Stack>
  )
}

function MultiDetails({ files }) {
  const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0)
  return (
    <Stack gap="md">
      <Field label="Selection" value={`${files.length} items`} />
      <Field label="Total size" value={formatBytes(totalSize)} />
      <Divider />
      <Stack gap={6}>
        {files.map((f) => (
          <Text key={f.path} size="sm" truncate title={f.name}>
            {f.name}
          </Text>
        ))}
      </Stack>
    </Stack>
  )
}

/**
 * File information panel. Accepts an array of entries so it works for a single
 * file or a multi-file selection — the caller decides what's "selected".
 */
export function FileDetails({ files }) {
  const list = (files ?? []).filter(Boolean)
  if (list.length === 0) return null

  return (
    <Box
      w={300}
      p="md"
      style={{
        borderRight: '1px solid var(--mantine-color-default-border)',
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      <Text fw={700} size="sm" mb="md">
        Details
      </Text>
      {list.length === 1 ? <SingleDetails entry={list[0]} /> : <MultiDetails files={list} />}
    </Box>
  )
}
