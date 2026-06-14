import { Flex, Text, Box } from '@mantine/core'
import { IconChevronRight, IconTagFilled } from '@tabler/icons-react'
import { useState } from 'react'
import { useTagsStore, buildTagTree } from '../stores/tagsStore.js'

function TagNode({ tag, depth, tree, activeTagId, onSelect }) {
  const collapsed = useTagsStore((s) => s.collapsed[tag.id])
  const toggleCollapse = useTagsStore((s) => s.toggleCollapse)
  const [hover, setHover] = useState(false)
  const children = tree.childrenOf(tag.id)
  const active = activeTagId === tag.id

  return (
    <>
      <Flex
        align="center"
        gap={4}
        py={6}
        pr="sm"
        mt={2}
        style={{
          paddingLeft: 8 + depth * 14,
          borderRadius: 8,
          cursor: 'pointer',
          background: active || hover ? 'var(--mantine-color-default-hover)' : 'transparent',
        }}
        onClick={() => {
          onSelect(tag.id)
          if (children.length > 0) toggleCollapse(tag.id)
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {children.length > 0 ? (
          <Box
            onClick={(e) => {
              // Toggle without changing the active filter.
              e.stopPropagation()
              toggleCollapse(tag.id)
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, flexShrink: 0 }}
          >
            <IconChevronRight
              size={14}
              color="var(--mantine-color-dimmed)"
              style={{ transform: collapsed ? 'none' : 'rotate(90deg)', transition: 'transform 120ms' }}
            />
          </Box>
        ) : (
          <Box w={20} />
        )}
        <IconTagFilled size={14} color={tag.color} style={{ flexShrink: 0 }} />
        <Text size="sm" truncate style={{ flex: 1 }}>
          {tag.name}
        </Text>
      </Flex>
      {!collapsed &&
        children.map((child) => (
          <TagNode
            key={child.id}
            tag={child}
            depth={depth + 1}
            tree={tree}
            activeTagId={activeTagId}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}

export function SidebarTagTree({ tags, activeTagId, onSelect }) {
  const tree = buildTagTree(tags)
  return tree.childrenOf('').map((tag) => (
    <TagNode key={tag.id} tag={tag} depth={0} tree={tree} activeTagId={activeTagId} onSelect={onSelect} />
  ))
}
