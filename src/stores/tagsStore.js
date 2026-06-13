import { create } from 'zustand'
import { api } from '../api.js'

function toMap(assignments) {
  const map = {}
  for (const a of assignments) (map[a.path] ||= []).push(a.tagId)
  return map
}

/**
 * Tags + their assignments. Backend is the source of truth; this store mirrors
 * it and re-fetches after mutations so every view (manager, context menu,
 * entry dots) stays consistent.
 */
export const useTagsStore = create((set, get) => ({
  tags: [],
  assignments: {}, // path -> [tagId]
  managerOpen: false,
  collapsed: {}, // tagId -> true when its children are hidden in the sidebar

  loadAll: async () => {
    const [tags, assignments] = await Promise.all([api.tags.list(), api.tags.assignments()])
    set({ tags, assignments: toMap(assignments) })
  },
  reloadTags: async () => set({ tags: await api.tags.list() }),
  reloadAssignments: async () => set({ assignments: toMap(await api.tags.assignments()) }),

  createTag: async (name, color, parentId) => {
    await api.tags.create(name, color, parentId)
    await get().reloadTags()
  },
  updateTag: async (id, changes) => {
    await api.tags.update(id, changes)
    await get().reloadTags()
  },
  deleteTag: async (id) => {
    await api.tags.remove(id)
    await Promise.all([get().reloadTags(), get().reloadAssignments()])
  },

  assign: async (path, tagId) => {
    await api.tags.assign(path, tagId)
    await get().reloadAssignments()
  },
  unassign: async (path, tagId) => {
    await api.tags.unassign(path, tagId)
    await get().reloadAssignments()
  },
  toggleAssign: async (path, tagId) => {
    const assigned = (get().assignments[path] || []).includes(tagId)
    return assigned ? get().unassign(path, tagId) : get().assign(path, tagId)
  },

  openManager: () => set({ managerOpen: true }),
  closeManager: () => set({ managerOpen: false }),

  toggleCollapse: (id) =>
    set((s) => ({ collapsed: { ...s.collapsed, [id]: !s.collapsed[id] } })),
}))

/** Build helpers from a flat tag list: children map + ordered tree + name path. */
export function buildTagTree(tags) {
  const byParent = new Map()
  const byId = new Map()
  for (const t of tags) {
    byId.set(t.id, t)
    const key = t.parentId || ''
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(t)
  }
  const childrenOf = (id) => byParent.get(id || '') || []
  const subtreeIds = (id) => {
    const out = new Set([id])
    for (const c of childrenOf(id)) for (const d of subtreeIds(c.id)) out.add(d)
    return out
  }
  const pathName = (tag) => {
    const parts = []
    const seen = new Set()
    let cur = tag
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id)
      parts.unshift(cur.name)
      cur = cur.parentId ? byId.get(cur.parentId) : null
    }
    return parts.join(' / ')
  }
  return { byId, childrenOf, subtreeIds, pathName }
}
