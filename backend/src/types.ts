export type EntryType = 'dir' | 'file'

/** A single directory entry, with its path expressed relative to the root. */
export interface Entry {
  name: string
  /** Path relative to the configured root ('' is the root itself). */
  path: string
  type: EntryType
  /** Size in bytes; 0 for directories. */
  size: number
  modifiedAt: string
}

/** The contents of one directory plus where it sits in the tree. */
export interface DirListing {
  path: string
  /** Parent path relative to root, or null when already at the root. */
  parent: string | null
  entries: Entry[]
}

/** A pinned location in the sidebar. */
export interface Favorite {
  path: string
  name: string
  createdAt: string
}

/** A user-defined tag (label + colour). May nest under a parent tag. */
export interface Tag {
  id: string
  name: string
  color: string
  /** Parent tag id, or null for a top-level tag. */
  parentId: string | null
  createdAt: string
}

/** A tag applied to a file/folder, by root-relative path. */
export interface TagAssignment {
  path: string
  tagId: string
}
