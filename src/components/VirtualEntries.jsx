import { useEffect, useLayoutEffect, useState } from 'react'
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
export function VirtualEntries({ entries, mode, zoom, scrollRef, renderEntry, tagsByPath }) {
  const grid = mode === 'grid'
  // The scroll viewport's *content* width — clientWidth minus its horizontal
  // padding (the marquee gutters) — so the grid column count stays correct.
  const measureWidth = (el) => {
    if (!el) return 0
    const cs = getComputedStyle(el)
    return el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0)
  }
  // Seed from the live element so the very first paint already has the real
  // width — otherwise the grid briefly computes 1 column (a single-column flash,
  // re-triggered on every remount via the view key).
  const [width, setWidth] = useState(() => measureWidth(scrollRef.current))

  // A tile's height depends on how many tags it carries, which can arrive/change
  // after the row first mounts. tanstack caches measurements by data-index and
  // won't re-measure a mounted row just because its content grew, so we fold the
  // row's tag composition into its key: when it changes, React remounts the row
  // and measureElement re-reads the now-correct height (no overlap/clipping).
  const tagSig = (rowEntries) =>
    tagsByPath ? rowEntries.map((e) => tagsByPath.get(e.path)?.length ?? 0).join(',') : ''

  // Track the viewport width so the grid can compute its column count. Measured
  // in a layout effect (before paint) to avoid a single-column first frame.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setWidth(measureWidth(el))
    const ro = new ResizeObserver(() => setWidth(measureWidth(el)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [scrollRef])

  const gap = 12
  const pad = grid ? 16 : 6
  const minTile = Math.round(92 * zoom)
  const cols = grid
    ? Math.max(1, Math.floor((Math.max(width, 1) - 2 * pad + gap) / (minTile + gap)))
    : 1
  const rowCount = grid ? Math.ceil(entries.length / cols) : entries.length

  // A tile's height varies with its thumbnail size, a (clamped) 2-line name, and
  // whether it carries tags. We estimate this per row so layout is correct even
  // before/without dynamic measurement — under-estimating would let the next row
  // overlap and clip a tile's tag chips. Over-reserving only adds a little gap.
  const estimateSize = (index) => {
    if (!grid) {
      return Math.round((mode === 'compact' ? 24 : 32) * zoom) + (mode === 'compact' ? 12 : 20)
    }
    const rowEntries = entries.slice(index * cols, index * cols + cols)
    const hasTags = tagsByPath && rowEntries.some((e) => (tagsByPath.get(e.path)?.length ?? 0) > 0)
    const NAME = 40 // room for a 2-line clamped name
    const TAGS = 26 // a single chip row
    const tile = Math.round(64 * zoom) + 24 /* p="sm" */ + 8 /* thumb→name gap */ + NAME + (hasTags ? 8 + TAGS : 0)
    return tile + gap // wrapper's paddingBottom
  }

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    // A small buffer above/below keeps edge thumbnails mounted across micro-scrolls.
    overscan: 6,
  })

  // Re-measure when anything affecting row heights changes.
  useEffect(() => {
    virtualizer.measure()
  }, [zoom, cols, mode, entries, tagsByPath, virtualizer])

  return (
    <Box style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
      {virtualizer.getVirtualItems().map((item) => {
        const rowEntries = grid
          ? entries.slice(item.index * cols, item.index * cols + cols)
          : [entries[item.index]]
        const content = grid ? (
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap,
              padding: `0 ${pad}px`,
            }}
          >
            {rowEntries.map(renderEntry)}
          </Box>
        ) : (
          <Box px={6}>{renderEntry(rowEntries[0])}</Box>
        )

        return (
          <div
            key={`${item.key}:${tagSig(rowEntries)}`}
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
