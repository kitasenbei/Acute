import { Box, Group, Text, ActionIcon, Modal, Button, Center, Tooltip } from '@mantine/core'
import {
  IconMusic,
  IconPlayerPlayFilled,
  IconPlayerPauseFilled,
  IconPlayerTrackNextFilled,
  IconPlayerTrackPrevFilled,
  IconX,
  IconTrash,
  IconRepeat,
  IconRepeatOnce,
} from '@tabler/icons-react'
import { useQueueStore } from '../stores/queueStore.js'
import { MarqueeTitle } from './AudioPlayer.jsx'

/** Drop a file extension for nicer display of a track title. */
const niceName = (name) => name.replace(/\.[^.]+$/, '')

/**
 * Compact "Now Playing" card for the sidebar. Renders only when a track is
 * current; the title opens the full playlist, the buttons control playback.
 */
export function NowPlaying() {
  const queue = useQueueStore((s) => s.queue)
  const index = useQueueStore((s) => s.index)
  const isPlaying = useQueueStore((s) => s.isPlaying)
  const togglePlay = useQueueStore((s) => s.togglePlay)
  const next = useQueueStore((s) => s.next)
  const prev = useQueueStore((s) => s.prev)
  const open = useQueueStore((s) => s.open)
  const repeat = useQueueStore((s) => s.repeat)
  const toggleRepeatOne = useQueueStore((s) => s.toggleRepeatOne)

  const current = index >= 0 && index < queue.length ? queue[index] : null
  if (!current) return null
  const loopingOne = repeat === 'one'

  return (
    <Box
      p={8}
      mb={6}
      style={{
        borderRadius: 8,
        background: 'var(--mantine-color-default-hover)',
      }}
    >
      <Group gap={6} wrap="nowrap" mb={6}>
        <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={open}>
          <IconMusic size={14} color="var(--mantine-color-teal-6)" style={{ flexShrink: 0 }} />
          <MarqueeTitle text={niceName(current.name)} size="xs" align="left" />
        </Group>
        <Tooltip label={loopingOne ? 'Repeating song' : 'Repeat song'} openDelay={300}>
          <ActionIcon
            size="sm"
            variant={loopingOne ? 'light' : 'subtle'}
            color={loopingOne ? 'teal' : 'gray'}
            onClick={toggleRepeatOne}
            style={{ flexShrink: 0 }}
          >
            <IconRepeatOnce size={13} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Group gap={4} justify="center" wrap="nowrap">
        <ActionIcon size="sm" variant="subtle" color="gray" onClick={prev} disabled={index <= 0}>
          <IconPlayerTrackPrevFilled size={13} />
        </ActionIcon>
        <ActionIcon
          size="md"
          variant={isPlaying ? 'light' : 'subtle'}
          color={isPlaying ? 'green' : 'gray'}
          radius="xl"
          onClick={togglePlay}
        >
          {isPlaying ? <IconPlayerPauseFilled size={15} /> : <IconPlayerPlayFilled size={15} />}
        </ActionIcon>
        <ActionIcon size="sm" variant="subtle" color="gray" onClick={next} disabled={index >= queue.length - 1}>
          <IconPlayerTrackNextFilled size={13} />
        </ActionIcon>
      </Group>
    </Box>
  )
}

/** The full play queue, shown in a modal opened from the sidebar. */
export function PlaylistModal() {
  const isOpen = useQueueStore((s) => s.isOpen)
  const close = useQueueStore((s) => s.close)
  const queue = useQueueStore((s) => s.queue)
  const index = useQueueStore((s) => s.index)
  const isPlaying = useQueueStore((s) => s.isPlaying)
  const playAt = useQueueStore((s) => s.playAt)
  const removeAt = useQueueStore((s) => s.removeAt)
  const togglePlay = useQueueStore((s) => s.togglePlay)
  const clear = useQueueStore((s) => s.clear)
  const repeat = useQueueStore((s) => s.repeat)
  const toggleRepeatAll = useQueueStore((s) => s.toggleRepeatAll)

  return (
    <Modal opened={isOpen} onClose={close} title="Playlist" size="md" radius="lg" centered>
      {queue.length === 0 ? (
        <Center h={120}>
          <Text size="sm" c="dimmed">
            Queue is empty — right-click a song and “Add to queue”.
          </Text>
        </Center>
      ) : (
        <>
          <Box style={{ maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden' }}>
            {queue.map((song, i) => {
              const isCurrent = i === index
              return (
                <Group
                  key={`${song.path}-${i}`}
                  gap={8}
                  wrap="nowrap"
                  px="xs"
                  py={6}
                  style={{
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: isCurrent ? 'var(--mantine-color-default-hover)' : undefined,
                  }}
                  onClick={() => (isCurrent ? togglePlay() : playAt(i))}
                >
                  <ActionIcon size="sm" variant={isCurrent ? 'light' : 'subtle'} color={isCurrent ? 'teal' : 'gray'} radius="xl">
                    {isCurrent && isPlaying ? <IconPlayerPauseFilled size={13} /> : <IconPlayerPlayFilled size={13} />}
                  </ActionIcon>
                  <Text size="sm" truncate style={{ flex: 1, minWidth: 0 }} fw={isCurrent ? 600 : 400} title={song.name}>
                    {niceName(song.name)}
                  </Text>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="gray"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAt(i)
                    }}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              )
            })}
          </Box>
          <Group justify="space-between" mt="md">
            <Group gap={8}>
              <Tooltip label={repeat === 'all' ? 'Looping list' : 'Loop list'} openDelay={300}>
                <ActionIcon
                  variant={repeat === 'all' ? 'light' : 'subtle'}
                  color={repeat === 'all' ? 'teal' : 'gray'}
                  onClick={toggleRepeatAll}
                >
                  <IconRepeat size={16} />
                </ActionIcon>
              </Tooltip>
              <Text size="xs" c="dimmed">
                {queue.length} {queue.length === 1 ? 'song' : 'songs'}
              </Text>
            </Group>
            <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={14} />} onClick={clear}>
              Clear queue
            </Button>
          </Group>
        </>
      )}
    </Modal>
  )
}
