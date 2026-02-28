import { useEffect, useMemo, useState } from 'react';

interface UseClientPaginationOptions {
  initialPageSize?: number;
  resetKey?: string | number;
}

export const useClientPagination = <T,>(
  items: T[],
  options: UseClientPaginationOptions = {}
) => {
  const { initialPageSize = 10, resetKey } = options;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const effectiveResetKey = resetKey ?? totalItems;

  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveResetKey, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, currentPage, pageSize]);

  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);

  return {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    paginatedItems,
    rangeStart,
    rangeEnd,
    setCurrentPage,
    setPageSize,
  };
};
