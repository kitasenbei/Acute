import '../monacoSetup.js'
import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Center, Loader, Text, useComputedColorScheme } from '@mantine/core'
import { api } from '../api.js'
import { monacoLanguage } from '../fileTypes.js'

/** Read-only Monaco viewer for code files, with syntax highlighting. */
export default function CodePreview({ entry }) {
  const [text, setText] = useState(null)
  const [error, setError] = useState(false)
  const scheme = useComputedColorScheme('dark')

  useEffect(() => {
    let cancelled = false
    setText(null)
    setError(false)
    fetch(api.contentUrl(entry.path))
      .then((r) => r.text())
      .then((t) => !cancelled && setText(t))
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
    }
  }, [entry.path])

  if (error) return <Center h={200}><Text c="dimmed" size="sm">Could not load file</Text></Center>
  if (text === null) return <Center h="75vh"><Loader size="sm" /></Center>

  return (
    <Editor
      height="75vh"
      theme={scheme === 'dark' ? 'vs-dark' : 'light'}
      language={monacoLanguage(entry.name)}
      value={text}
      loading={<Center h="75vh"><Loader size="sm" /></Center>}
      options={{
        readOnly: true,
        domReadOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        wordWrap: 'on',
        renderWhitespace: 'none',
      }}
    />
  )
}
