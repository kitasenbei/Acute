import { useState, useMemo } from 'react'
import {
  Modal,
  Stack,
  Group,
  Text,
  TextInput,
  ColorInput,
  Select,
  Button,
  ActionIcon,
  ColorSwatch,
  Center,
} from '@mantine/core'
import { IconTrash, IconTags } from '@tabler/icons-react'
import { useTagsStore, buildTagTree } from '../stores/tagsStore.js'

// A friendly default palette offered in the colour pickers.
const PALETTE = [
  '#e03131', '#e8590c', '#f08c00', '#2f9e44', '#099268',
  '#1971c2', '#3b5bdb', '#6741d9', '#9c36b5', '#c2255c',
  '#495057', '#868e96',
]

function TagRow({ tag, depth, parentOptions, onRename, onRecolor, onReparent, onDelete }) {
  return (
    <Group gap="sm" wrap="nowrap" style={{ paddingLeft: depth * 18 }}>
      <ColorInput
        value={tag.color}
        onChangeEnd={(c) => c && onRecolor(tag, c)}
        format="hex"
        size="xs"
        w={120}
        swatches={PALETTE}
        withEyeDropper={false}
      />
      <TextInput
        defaultValue={tag.name}
        size="xs"
        style={{ flex: 1 }}
        onBlur={(e) => onRename(tag, e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <Select
        size="xs"
        w={150}
        placeholder="Top level"
        data={parentOptions}
        value={tag.parentId ?? ''}
        onChange={(v) => onReparent(tag, v || null)}
        comboboxProps={{ withinPortal: true }}
      />
      <ActionIcon variant="subtle" color="red" onClick={() => onDelete(tag)}>
        <IconTrash size={16} />
      </ActionIcon>
    </Group>
  )
}

export function TagManagerModal() {
  const opened = useTagsStore((s) => s.managerOpen)
  const close = useTagsStore((s) => s.closeManager)
  const tags = useTagsStore((s) => s.tags)
  const createTag = useTagsStore((s) => s.createTag)
  const updateTag = useTagsStore((s) => s.updateTag)
  const deleteTag = useTagsStore((s) => s.deleteTag)

  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[5])
  const [parentId, setParentId] = useState('')
  const [error, setError] = useState(null)

  const tree = useMemo(() => buildTagTree(tags), [tags])

  // Tags flattened depth-first, so rows render as an indented tree.
  const ordered = useMemo(() => {
    const out = []
    const walk = (nodes, depth) => {
      for (const t of nodes) {
        out.push({ tag: t, depth })
        walk(tree.childrenOf(t.id), depth + 1)
      }
    }
    walk(tree.childrenOf(''), 0)
    return out
  }, [tree])

  const allParentOptions = useMemo(
    () => tags.map((t) => ({ value: t.id, label: tree.pathName(t) })),
    [tags, tree],
  )

  const run = async (fn) => {
    try {
      await fn()
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }

  const add = () => {
    if (!name.trim()) return
    run(async () => {
      await createTag(name.trim(), color, parentId || null)
      setName('')
    })
  }

  // A tag can't be parented under itself or any of its descendants.
  const parentOptionsFor = (tag) => {
    const sub = tree.subtreeIds(tag.id)
    return allParentOptions.filter((o) => !sub.has(o.value))
  }

  return (
    <Modal opened={opened} onClose={close} title="Tags" size="lg" radius="lg" centered>
      <Stack gap="md">
        {/* Create */}
        <Group gap="sm" wrap="nowrap" align="flex-end">
          <ColorInput
            value={color}
            onChange={setColor}
            format="hex"
            size="xs"
            w={120}
            swatches={PALETTE}
            withEyeDropper={false}
          />
          <TextInput
            placeholder="New tag name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            size="xs"
            style={{ flex: 1 }}
          />
          <Select
            size="xs"
            w={150}
            placeholder="Top level"
            data={allParentOptions}
            value={parentId}
            onChange={(v) => {
              setParentId(v || '')
              // Default the new tag's colour to its parent's.
              const parent = v && tags.find((t) => t.id === v)
              if (parent) setColor(parent.color)
            }}
            comboboxProps={{ withinPortal: true }}
            clearable
          />
          <Button size="xs" onClick={add} disabled={!name.trim()}>
            Add
          </Button>
        </Group>

        {error && (
          <Text size="xs" c="red">
            {error}
          </Text>
        )}

        {/* List */}
        {tags.length === 0 ? (
          <Center h={120}>
            <Group gap={8} c="dimmed">
              <IconTags size={18} />
              <Text size="sm">No tags yet — create one above</Text>
            </Group>
          </Center>
        ) : (
          <Stack gap="xs">
            {ordered.map(({ tag, depth }) => (
              <TagRow
                key={tag.id}
                tag={tag}
                depth={depth}
                parentOptions={parentOptionsFor(tag)}
                onRename={(t, value) => value.trim() && value !== t.name && run(() => updateTag(t.id, { name: value.trim() }))}
                onRecolor={(t, c) => run(() => updateTag(t.id, { color: c }))}
                onReparent={(t, pid) => run(() => updateTag(t.id, { parentId: pid }))}
                onDelete={(t) => run(() => deleteTag(t.id))}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Modal>
  )
}

/** Small coloured dots shown on entries to indicate their tags. */
export function TagDots({ tags, max = 4 }) {
  if (!tags?.length) return null
  return (
    <Group gap={3} wrap="nowrap">
      {tags.slice(0, max).map((t) => (
        <ColorSwatch key={t.id} color={t.color} size={8} title={t.name} />
      ))}
      {tags.length > max && (
        <Text size="xs" c="dimmed">
          +{tags.length - max}
        </Text>
      )}
    </Group>
  )
}
