import { useEffect, useState, lazy, Suspense } from 'react'
import {
  Modal,
  Flex,
  Group,
  Text,
  ScrollArea,
  Center,
  Loader,
  Button,
  ActionIcon,
  Tooltip,
  Box,
} from '@mantine/core'
import {
  IconX,
  IconInfoCircle,
  IconExternalLink,
  IconFolderOpen,
  IconDownload,
  IconFileOff,
} from '@tabler/icons-react'
import { api } from '../api.js'
import { fileKind } from '../fileTypes.js'
import { usePreviewStore } from '../stores/previewStore.js'
import { FileDetails } from './FileDetails.jsx'
import { VideoPlayer } from './VideoPlayer.jsx'
import { AudioPlayer } from './AudioPlayer.jsx'

// Monaco is heavy — load it only when a code file is actually previewed.
const CodePreview = lazy(() => import('./CodePreview.jsx'))

const native = typeof window !== 'undefined' ? window.native : undefined

/** Fetches and renders text/code content. */
function TextPreview({ url }) {
  const [text, setText] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setText(null)
    setError(false)
    fetch(url)
      .then((r) => r.text())
      .then((t) => !cancelled && setText(t))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [url])

  if (error) return <Center h={200}><Text c="dimmed" size="sm">Could not load file</Text></Center>
  if (text === null) return <Center h={200}><Loader size="sm" /></Center>

  return (
    <ScrollArea.Autosize mah="70vh">
      <Box
        component="pre"
        p="md"
        style={{
          margin: 0,
          fontFamily: 'var(--mantine-font-family-monospace)',
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </Box>
    </ScrollArea.Autosize>
  )
}

function NoPreview({ entry }) {
  return (
    <Center h={260}>
      <Flex direction="column" align="center" gap="sm">
        <IconFileOff size={40} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed" size="sm">
          No in-app preview for this file type
        </Text>
        {native && (
          <Button
            size="xs"
            variant="light"
            leftSection={<IconExternalLink size={15} />}
            onClick={() => native.openPath(entry.path)}
          >
            Open with default app
          </Button>
        )}
      </Flex>
    </Center>
  )
}

function PreviewBody({ entry, nav }) {
  const url = api.contentUrl(entry.path)
  switch (fileKind(entry)) {
    case 'image':
      return (
        <Center p="md">
          <img
            src={url}
            alt={entry.name}
            style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: 8 }}
          />
        </Center>
      )
    case 'video':
      return <VideoPlayer src={url} />
    case 'audio':
      return <AudioPlayer src={url} name={entry.name} {...nav} />
    case 'pdf':
      return <iframe src={url} title={entry.name} style={{ width: '100%', height: '75vh', border: 'none' }} />
    case 'code':
      return (
        <Suspense fallback={<Center h="75vh"><Loader size="sm" /></Center>}>
          <CodePreview entry={entry} />
        </Suspense>
      )
    case 'text':
      return <TextPreview url={url} />
    default:
      return <NoPreview entry={entry} />
  }
}

export function PreviewModal() {
  const entry = usePreviewStore((s) => s.entry)
  const isOpen = usePreviewStore((s) => s.isOpen)
  const close = usePreviewStore((s) => s.close)
  const showDetails = usePreviewStore((s) => s.showDetails)
  const toggleDetails = usePreviewStore((s) => s.toggleDetails)
  const playlist = usePreviewStore((s) => s.playlist)
  const index = usePreviewStore((s) => s.index)
  const next = usePreviewStore((s) => s.next)
  const prev = usePreviewStore((s) => s.prev)
  const nav = { onPrev: prev, onNext: next, hasPrev: index > 0, hasNext: index < playlist.length - 1 }

  // Blend the header into the video's black letterbox bands.
  const videoMode = entry ? fileKind(entry) === 'video' : false
  const iconColor = videoMode ? 'gray.3' : 'gray'

  return (
    <Modal
      opened={isOpen}
      onClose={close}
      withCloseButton={false}
      padding={0}
      radius="lg"
      size="62rem"
      centered
      overlayProps={{ backgroundOpacity: 0.5, blur: 2 }}
    >
      {entry && (
        <Flex direction="column" mah="86vh">
          {/* Header */}
          <Flex
            align="center"
            justify="space-between"
            gap="sm"
            px="md"
            h={52}
            style={{
              flexShrink: 0,
              background: videoMode ? '#000' : undefined,
              borderBottom: videoMode ? '1px solid #000' : '1px solid var(--mantine-color-default-border)',
            }}
          >
            <Text size="sm" fw={600} truncate c={videoMode ? 'gray.3' : undefined}>
              {entry.name}
            </Text>
            <Group gap={4} wrap="nowrap">
              <Tooltip label="Details" openDelay={400}>
                <ActionIcon
                  variant={showDetails ? 'light' : 'subtle'}
                  color={iconColor}
                  onClick={toggleDetails}
                >
                  <IconInfoCircle size={18} />
                </ActionIcon>
              </Tooltip>
              {native && (
                <>
                  <Tooltip label="Open with default app" openDelay={400}>
                    <ActionIcon variant="subtle" color={iconColor} onClick={() => native.openPath(entry.path)}>
                      <IconExternalLink size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Reveal in file manager" openDelay={400}>
                    <ActionIcon variant="subtle" color={iconColor} onClick={() => native.showInFolder(entry.path)}>
                      <IconFolderOpen size={18} />
                    </ActionIcon>
                  </Tooltip>
                </>
              )}
              <Tooltip label="Download" openDelay={400}>
                <ActionIcon variant="subtle" color={iconColor} onClick={() => api.download(entry)}>
                  <IconDownload size={18} />
                </ActionIcon>
              </Tooltip>
              <ActionIcon variant="subtle" color={iconColor} onClick={close}>
                <IconX size={18} />
              </ActionIcon>
            </Group>
          </Flex>

          {/* Body: optional details panel on the left, content on the right. */}
          <Flex style={{ flex: 1, minHeight: 0 }}>
            {showDetails && <FileDetails files={[entry]} />}
            <Box style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
              <PreviewBody entry={entry} nav={nav} />
            </Box>
          </Flex>
        </Flex>
      )}
    </Modal>
  )
}
