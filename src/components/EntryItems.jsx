import { memo, useState } from 'react'
import { Flex, Box, Group, Text, TextInput, Tooltip, ActionIcon } from '@mantine/core'
import { IconStar, IconStarFilled, IconEye, IconPencil } from '@tabler/icons-react'
import { formatBytes, formatDate } from '../util.js'
import { Thumb } from './Thumb.jsx'
import { TagChips } from './TagManagerModal.jsx'

/** Inline name editor reused by every view mode. */
export function NameField({ entry, onCommit, onCancel }) {
  return (
    <TextInput
      size="xs"
      defaultValue={entry.name}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => onCommit(entry, e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(entry, e.currentTarget.value)
        if (e.key === 'Escape') onCancel()
      }}
    />
  )
}

export const EntryRow = memo(function EntryRow({ entry, editing, pinned, compact, zoom = 1, selected, tags, onOpen, onOpenFile, onStartEdit, onCommitEdit, onCancelEdit,
  onTogglePin, onContextMenu, onDragStart, onDropInto, onDropOver, dropActive }) {
  const [hover, setHover] = useState(false)
  const isDir = entry.type === 'dir'
  const base = compact ? 24 : 32
  const thumbSize = Math.round(base * zoom)
  const dropProps = isDir
    ? {
        onDragOver: (e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onDropOver?.(entry.path)
        },
        onDragLeave: () => onDropOver?.(null),
        onDrop: (e) => {
          e.preventDefault()
          onDropInto?.(entry.path)
        },
      }
    : {}

  return (
    <Flex
      data-path={entry.path}
      draggable
      onDragStart={(e) => onDragStart?.(entry, e)}
      {...dropProps}
      align="center"
      gap="sm"
      px="md"
      py={compact ? 3 : 7}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDoubleClick={() => (isDir ? onOpen(entry) : onOpenFile(entry))}
      onContextMenu={(e) => onContextMenu(entry, e)}
      style={{
        borderRadius: 8,
        cursor: 'default',
        outline: dropActive ? '2px solid var(--mantine-primary-color-filled)' : undefined,
        outlineOffset: -2,
        background: dropActive
          ? 'var(--mantine-primary-color-light)'
          : selected
            ? 'var(--mantine-primary-color-light)'
            : hover
              ? 'var(--mantine-color-default-hover)'
              : 'transparent',
      }}
    >
      <Thumb entry={entry} size={thumbSize} />

      <Box style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <NameField entry={entry} onCommit={onCommitEdit} onCancel={onCancelEdit} />
        ) : (
          <Text size="sm" truncate>
            {entry.name}
          </Text>
        )}
      </Box>

      <TagChips tags={tags} />

      <Text size="xs" c="dimmed" w={70} ta="right">
        {isDir ? '' : formatBytes(entry.size)}
      </Text>
      {!compact && (
        <Text size="xs" c="dimmed" w={100} ta="right" visibleFrom="sm">
          {formatDate(entry.modifiedAt)}
        </Text>
      )}

      {/* Actions mount only on hover — keeps non-hovered (and scrolling) rows light. */}
      <Group gap={2} w={118} justify="flex-end">
        {hover &&
          (isDir ? (
            <Tooltip label={pinned ? 'Unpin' : 'Pin'} openDelay={400}>
              <ActionIcon variant="subtle" color={pinned ? 'yellow' : 'gray'} onClick={() => onTogglePin(entry)}>
                {pinned ? <IconStarFilled size={15} /> : <IconStar size={15} />}
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label="Open" openDelay={400}>
              <ActionIcon variant="subtle" color="gray" onClick={() => onOpenFile(entry)}>
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
          ))}
        {hover && (
          <Tooltip label="Rename" openDelay={400}>
            <ActionIcon variant="subtle" color="gray" onClick={() => onStartEdit(entry.path)}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Flex>
  )
})

export const EntryTile = memo(function EntryTile({ entry, editing, pinned, zoom = 1, selected, tags, onOpen, onOpenFile, onStartEdit, onCommitEdit, onCancelEdit,
  onTogglePin, onContextMenu, onDragStart, onDropInto, onDropOver, dropActive }) {
  const [hover, setHover] = useState(false)
  const isDir = entry.type === 'dir'
  const thumbSize = Math.round(64 * zoom)
  const dropProps = isDir
    ? {
        onDragOver: (e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          onDropOver?.(entry.path)
        },
        onDragLeave: () => onDropOver?.(null),
        onDrop: (e) => {
          e.preventDefault()
          onDropInto?.(entry.path)
        },
      }
    : {}

  return (
    <Flex
      data-path={entry.path}
      draggable
      onDragStart={(e) => onDragStart?.(entry, e)}
      {...dropProps}
      direction="column"
      align="center"
      gap={8}
      p="sm"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDoubleClick={() => (isDir ? onOpen(entry) : onOpenFile(entry))}
      onContextMenu={(e) => onContextMenu(entry, e)}
      style={{
        position: 'relative',
        borderRadius: 10,
        cursor: 'default',
        outline: dropActive ? '2px solid var(--mantine-primary-color-filled)' : undefined,
        outlineOffset: -2,
        background: dropActive || selected
          ? 'var(--mantine-primary-color-light)'
          : hover
            ? 'var(--mantine-color-default-hover)'
            : 'transparent',
      }}
    >
      {hover && (
        <Group gap={2} style={{ position: 'absolute', top: 4, right: 4 }}>
          {isDir ? (
            <ActionIcon variant="subtle" color={pinned ? 'yellow' : 'gray'} size="sm" onClick={() => onTogglePin(entry)}>
              {pinned ? <IconStarFilled size={14} /> : <IconStar size={14} />}
            </ActionIcon>
          ) : (
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onOpenFile(entry)}>
              <IconEye size={14} />
            </ActionIcon>
          )}
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onStartEdit(entry.path)}>
            <IconPencil size={14} />
          </ActionIcon>
        </Group>
      )}

      <Thumb entry={entry} size={thumbSize} />

      <Box w="100%" style={{ textAlign: 'center' }}>
        {editing ? (
          <NameField entry={entry} onCommit={onCommitEdit} onCancel={onCancelEdit} />
        ) : (
          <Text size="xs" ta="center" lineClamp={2} title={entry.name}>
            {entry.name}
          </Text>
        )}
      </Box>
      {tags?.length > 0 && (
        <Group justify="center" style={{ maxWidth: '100%' }}>
          <TagChips tags={tags} max={2} />
        </Group>
      )}
    </Flex>
  )
})
