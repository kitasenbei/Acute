import { useState, useMemo } from 'react'
import {
  Modal,
  Stack,
  Group,
  Text,
  TextInput,
  Select,
  Button,
  ActionIcon,
  Badge,
  Center,
  Popover,
  ColorSwatch,
  UnstyledButton,
  ScrollArea,
  Box,
} from '@mantine/core'
import { IconTrash, IconTags, IconTagFilled } from '@tabler/icons-react'
import { useTagsStore, buildTagTree } from '../stores/tagsStore.js'

// A friendly default palette offered in the colour pickers.
const PALETTE = [
  '#e03131', '#e8590c', '#f08c00', '#2f9e44', '#099268',
  '#1971c2', '#3b5bdb', '#6741d9', '#9c36b5', '#c2255c',
  '#495057', '#868e96',
]

/** Compact colour picker: a swatch that opens a palette popover. */
function ColorPick({ value, onChange }) {
  return (
    <Popover position="bottom-start" shadow="md" withinPortal>
      <Popover.Target>
        <UnstyledButton style={{ display: 'flex', flexShrink: 0 }} aria-label="Pick colour">
          <ColorSwatch color={value} size={22} style={{ cursor: 'pointer' }}>
            <IconTagFilled size={12} color="var(--mantine-color-white)" style={{ opacity: 0.9 }} />
          </ColorSwatch>
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <Group gap={6} style={{ maxWidth: 156 }}>
          {PALETTE.map((c) => (
            <ColorSwatch
              key={c}
              color={c}
              size={22}
              style={{ cursor: 'pointer', outline: c === value ? '2px solid var(--mantine-color-default-border)' : 'none', outlineOffset: 2 }}
              onClick={() => onChange(c)}
            />
          ))}
        </Group>
      </Popover.Dropdown>
    </Popover>
  )
}

function TagRow({ tag, depth, parentOptions, onRename, onRecolor, onReparent, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <Group
      gap="sm"
      wrap="nowrap"
      px="xs"
      py={5}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        marginLeft: depth * 18,
        borderRadius: 8,
        background: hover ? 'var(--mantine-color-default-hover)' : 'transparent',
      }}
    >
      <ColorPick value={tag.color} onChange={(c) => onRecolor(tag, c)} />
      <TextInput
        variant="unstyled"
        defaultValue={tag.name}
        size="sm"
        style={{ flex: 1 }}
        styles={{ input: { fontWeight: 500 } }}
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
        clearable
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
    <Modal
      opened={opened}
      onClose={close}
      size="lg"
      radius="lg"
      centered
      title={
        <Group gap="xs">
          <IconTags size={18} />
          <Text fw={600}>Tags</Text>
        </Group>
      }
    >
      <Stack gap="lg">
        {/* Create */}
        <Box>
          <Text size="xs" c="dimmed" fw={600} mb={6}>
            New tag
          </Text>
          <Group
            gap="sm"
            wrap="nowrap"
            p="xs"
            style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 10 }}
          >
            <ColorPick value={color} onChange={setColor} />
            <TextInput
              variant="unstyled"
              placeholder="Tag name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              size="sm"
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
            <Text size="xs" c="red" mt={6}>
              {error}
            </Text>
          )}
        </Box>

        {/* List */}
        {tags.length === 0 ? (
          <Center h={140}>
            <Stack align="center" gap={6} c="dimmed">
              <IconTags size={26} />
              <Text size="sm">No tags yet — create one above</Text>
            </Stack>
          </Center>
        ) : (
          <Box>
            <Text size="xs" c="dimmed" fw={600} mb={6}>
              Your tags · {tags.length}
            </Text>
            <ScrollArea.Autosize mah="48vh" type="hover">
              <Stack gap={2}>
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
            </ScrollArea.Autosize>
          </Box>
        )}
      </Stack>
    </Modal>
  )
}

/** Coloured name chips shown on entries to indicate their tags. */
export function TagChips({ tags, max = 3 }) {
  if (!tags?.length) return null
  return (
    <Group gap={4} wrap="nowrap">
      {tags.slice(0, max).map((t) => (
        <Badge
          key={t.id}
          size="xs"
          variant="filled"
          color={t.color}
          autoContrast
          title={t.name}
          leftSection={<IconTagFilled size={9} />}
          styles={{
            root: { maxWidth: 120, textTransform: 'none', fontWeight: 500 },
            label: { overflow: 'hidden', textOverflow: 'ellipsis' },
          }}
        >
          {t.name}
        </Badge>
      ))}
      {tags.length > max && (
        <Text size="xs" c="dimmed">
          +{tags.length - max}
        </Text>
      )}
    </Group>
  )
}
