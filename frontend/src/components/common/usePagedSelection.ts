import { useEffect, useMemo, useState } from 'react'

export type CollectionViewMode = 'table' | 'grid'

interface UsePagedSelectionOptions<T> {
  items: T[]
  getId: (item: T) => string | number
  initialPageSize?: number
}

export function usePagedSelection<T>({
  items,
  getId,
  initialPageSize = 10
}: UsePagedSelectionOptions<T>) {
  const [viewMode, setViewMode] = useState<CollectionViewMode>('table')
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const allIds = useMemo(() => items.map(item => String(getId(item))), [items, getId])
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))

  useEffect(() => {
    setPage(current => Math.min(Math.max(1, current), totalPages))
  }, [totalPages])

  useEffect(() => {
    setSelectedIds(current => {
      const next = new Set<string>()
      for (const id of current) {
        if (allIds.includes(id)) {
          next.add(id)
        }
      }
      return next
    })
  }, [allIds])

  const pageStart = (page - 1) * pageSize
  const pageItems = items.slice(pageStart, pageStart + pageSize)
  const pageIds = pageItems.map(item => String(getId(item)))

  const isPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))
  const isPagePartiallySelected = pageIds.some(id => selectedIds.has(id)) && !isPageSelected

  function toggleRowSelection(id: string | number) {
    const normalized = String(id)
    setSelectedIds(current => {
      const next = new Set(current)
      if (next.has(normalized)) {
        next.delete(normalized)
      } else {
        next.add(normalized)
      }
      return next
    })
  }

  function togglePageSelection() {
    if (pageIds.length === 0) {
      return
    }

    setSelectedIds(current => {
      const next = new Set(current)
      if (pageIds.every(id => next.has(id))) {
        pageIds.forEach(id => next.delete(id))
      } else {
        pageIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  function updatePageSize(nextSize: number) {
    setPageSize(nextSize)
    setPage(1)
  }

  return {
    viewMode,
    setViewMode,
    pageSize,
    setPageSize: updatePageSize,
    page,
    setPage,
    totalPages,
    pageStart,
    pageItems,
    selectedIds,
    selectedCount: selectedIds.size,
    isPageSelected,
    isPagePartiallySelected,
    toggleRowSelection,
    togglePageSelection
  }
}
