import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, useMantineColorScheme } from '@mantine/core'
import '@mantine/core/styles.css'
import App from './App.jsx'
import { SettingsModal } from './components/SettingsModal.jsx'
import { PreviewModal } from './components/PreviewModal.jsx'
import { ContextMenu } from './components/ContextMenu.jsx'
import { TagManagerModal } from './components/TagManagerModal.jsx'
import { useSettingsStore } from './stores/settingsStore.js'

/** Pushes the zustand `appearance` preference into Mantine's color scheme. */
function ThemeSync() {
  const appearance = useSettingsStore((s) => s.appearance)
  const { setColorScheme } = useMantineColorScheme()
  useEffect(() => {
    setColorScheme(appearance)
  }, [appearance, setColorScheme])
  return null
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto">
      <ThemeSync />
      <App />
      <SettingsModal />
      <PreviewModal />
      <ContextMenu />
      <TagManagerModal />
    </MantineProvider>
  </React.StrictMode>,
)
