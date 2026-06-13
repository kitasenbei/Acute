import { useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Box } from '@mantine/core'

/**
 * Windowed renderer for a directory's entries: only the rows visible in the
 * scroll viewport are mounted, so directories with thousands of files stay
 * smooth. Works for both the single-column list/compact modes and the grid.
 *
 * `renderEntry(entry)` returns the row/tile element; this component owns only
 * layout + windowing, keeping the explorer's item logic untouched.
 */
export function VirtualEntries({ entries, mode, zoom, scrollRef, renderEntry }) {
  const grid = mode === 'grid'
  const [width, setWidth] = useState(0)

  // Track the viewport width so the grid can compute its column count.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [scrollRef])

  const gap = 12
  const pad = grid ? 16 : 6
  const minTile = Math.round(92 * zoom)
  const cols = grid
    ? Math.max(1, Math.floor((Math.max(width, 1) - 2 * pad + gap) / (minTile + gap)))
    : 1
  const estRow = grid
    ? Math.round(64 * zoom) + 56
    : Math.round((mode === 'compact' ? 24 : 32) * zoom) + (mode === 'compact' ? 12 : 20)
  const rowCount = grid ? Math.ceil(entries.length / cols) : entries.length

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estRow,
    overscan: 8,
  })

  // Re-measure when sizing inputs change (zoom / column count).
  useEffect(() => {
    virtualizer.measure()
  }, [zoom, cols, virtualizer])

  return (
    <Box style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
      {virtualizer.getVirtualItems().map((item) => {
        const content = grid ? (
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap,
              padding: `0 ${pad}px`,
            }}
          >
            {entries.slice(item.index * cols, item.index * cols + cols).map(renderEntry)}
          </Box>
        ) : (
          <Box px={6}>{renderEntry(entries[item.index])}</Box>
        )

        return (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start}px)`,
              paddingBottom: grid ? gap : 0,
            }}
          >
            {content}
          </div>
        )
      })}
    </Box>
  )
}
