import {
  Modal,
  Flex,
  Box,
  Stack,
  Group,
  Text,
  TextInput,
  ScrollArea,
  SegmentedControl,
  Switch,
  ThemeIcon,
  ActionIcon,
  UnstyledButton,
  Center,
} from '@mantine/core'
import {
  IconSearch,
  IconX,
  IconSettings,
  IconUserCircle,
  IconLock,
  IconCreditCard,
  IconChartBar,
  IconBriefcase,
  IconPlugConnected,
  IconDeviceDesktop,
  IconSun,
  IconMoon,
} from '@tabler/icons-react'
import { useSettingsStore } from '../stores/settingsStore.js'

const NAV = [
  { id: 'general', label: 'General', icon: IconSettings },
  { id: 'account', label: 'Account', icon: IconUserCircle },
  { id: 'privacy', label: 'Privacy', icon: IconLock },
  { id: 'billing', label: 'Billing', icon: IconCreditCard },
  { id: 'usage', label: 'Usage', icon: IconChartBar },
  { id: 'capabilities', label: 'Capabilities', icon: IconBriefcase },
  { id: 'connectors', label: 'Connectors', icon: IconPlugConnected },
]

function NavItem({ item, active, onClick }) {
  const { icon: Icon, label } = item
  return (
    <UnstyledButton
      onClick={onClick}
      w="100%"
      px="sm"
      py={8}
      style={{
        borderRadius: 8,
        background: active ? 'var(--mantine-color-default-hover)' : 'transparent',
      }}
    >
      <Group gap="sm" wrap="nowrap">
        <Icon size={18} color="var(--mantine-color-dimmed)" />
        <Text size="sm" fw={active ? 600 : 400}>
          {label}
        </Text>
      </Group>
    </UnstyledButton>
  )
}

/** A row of label + control, matching the claude.ai preferences layout. */
function Row({ label, children }) {
  return (
    <Group justify="space-between" align="center" py="md" wrap="nowrap">
      <Text size="sm">{label}</Text>
      {children}
    </Group>
  )
}

function AppearanceControl() {
  const appearance = useSettingsStore((s) => s.appearance)
  const setAppearance = useSettingsStore((s) => s.setAppearance)
  return (
    <SegmentedControl
      value={appearance}
      onChange={setAppearance}
      size="sm"
      data={[
        { value: 'auto', label: <Center><IconDeviceDesktop size={16} /></Center> },
        { value: 'light', label: <Center><IconSun size={16} /></Center> },
        { value: 'dark', label: <Center><IconMoon size={16} /></Center> },
      ]}
    />
  )
}

function AutoplayVideoControl() {
  const autoplayVideo = useSettingsStore((s) => s.autoplayVideo)
  const setAutoplayVideo = useSettingsStore((s) => s.setAutoplayVideo)
  return <Switch checked={autoplayVideo} onChange={(e) => setAutoplayVideo(e.currentTarget.checked)} />
}

function GeneralPanel() {
  return (
    <Stack gap={0}>
      <Text fw={700} size="lg" mb="xs">
        Preferences
      </Text>
      <Box>
        <Row label="Appearance">
          <AppearanceControl />
        </Row>
        <Row label="Autoplay video">
          <AutoplayVideoControl />
        </Row>
      </Box>
    </Stack>
  )
}

function PlaceholderPanel({ label }) {
  return (
    <Center h={200}>
      <Text size="sm" c="dimmed">
        {label} settings coming soon
      </Text>
    </Center>
  )
}

export function SettingsModal() {
  const isOpen = useSettingsStore((s) => s.isOpen)
  const close = useSettingsStore((s) => s.closeSettings)
  const section = useSettingsStore((s) => s.section)
  const setSection = useSettingsStore((s) => s.setSection)

  const active = NAV.find((n) => n.id === section) ?? NAV[0]

  return (
    <Modal
      opened={isOpen}
      onClose={close}
      withCloseButton={false}
      padding={0}
      radius="lg"
      size="56rem"
      centered
      overlayProps={{ backgroundOpacity: 0.4, blur: 1 }}
      styles={{ body: { height: '34rem' } }}
    >
      <Flex h="100%">
        {/* Sidebar */}
        <Box
          w={250}
          p="sm"
          style={{ borderRight: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }}
        >
          <TextInput placeholder="Search" leftSection={<IconSearch size={16} />} radius="md" mb="sm" />
          <Text size="xs" c="dimmed" fw={600} px="sm" mb={4}>
            Settings
          </Text>
          <Stack gap={2}>
            {NAV.map((item) => (
              <NavItem
                key={item.id}
                item={item}
                active={item.id === section}
                onClick={() => setSection(item.id)}
              />
            ))}
          </Stack>
        </Box>

        {/* Content */}
        <Box style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={close}
            style={{ position: 'absolute', top: 16, right: 16, zIndex: 1 }}
          >
            <IconX size={18} />
          </ActionIcon>
          <ScrollArea h="100%" px="xl" py="lg">
            {section === 'general' ? <GeneralPanel /> : <PlaceholderPanel label={active.label} />}
          </ScrollArea>
        </Box>
      </Flex>
    </Modal>
  )
}
