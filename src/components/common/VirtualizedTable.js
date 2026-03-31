import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
} from '@mui/material';

/**
 * Default threshold below which we skip virtualization and render
 * every row normally (the DOM cost is negligible).
 */
const VIRTUALIZATION_THRESHOLD = 50;

/**
 * A virtualized MUI Table component for rendering large datasets
 * efficiently. Only the rows visible inside the scroll viewport (plus an
 * overscan buffer) are mounted in the DOM.  The table header is fixed at
 * the top of the container so it is always visible while scrolling.
 *
 * No additional dependencies are required -- positioning is handled
 * entirely with CSS overflow and calculated transforms.
 *
 * @param {object}   props
 * @param {Array<{field: string, headerName: string, width?: number|string, renderCell?: Function}>}
 *                   props.columns       - Column definitions.
 *                     - field:      key used to read the value from each row object.
 *                     - headerName: label shown in the header.
 *                     - width:      optional CSS width (number px or string).
 *                     - renderCell: optional (value, row, rowIndex) => ReactNode.
 * @param {Array}    props.rows          - Array of row data objects.
 * @param {number}   [props.rowHeight=52]  - Estimated row height in pixels.
 * @param {number}   [props.maxHeight=500] - Max height of the scrollable area.
 * @param {Function} [props.onRowClick]    - (row, rowIndex) => void.
 * @param {number}   [props.overscanCount=5] - Extra rows above/below viewport.
 * @param {number}   [props.threshold]       - Row count below which virtualization is skipped.
 * @param {object}   [props.sx]              - MUI sx prop for the outer container.
 * @param {Function} [props.getRowId]        - (row, index) => unique key. Defaults to index.
 */
const VirtualizedTable = ({
  columns = [],
  rows = [],
  rowHeight = 52,
  maxHeight = 500,
  onRowClick,
  overscanCount = 5,
  threshold = VIRTUALIZATION_THRESHOLD,
  sx = {},
  getRowId,
}) => {
  // ── Refs ──────────────────────────────────────────────────────────────
  const bodyRef = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────
  const [scrollTop, setScrollTop] = useState(0);

  // ── Scroll handler ────────────────────────────────────────────────────
  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // ── Row key helper ────────────────────────────────────────────────────
  const rowKey = useCallback(
    (row, index) => {
      if (getRowId) return getRowId(row, index);
      if (row.id !== undefined) return row.id;
      return index;
    },
    [getRowId],
  );

  // ── Shared column widths style helper ─────────────────────────────────
  const cellSx = useCallback(
    (col) => ({
      width: col.width ?? 'auto',
      minWidth: col.minWidth ?? undefined,
      maxWidth: col.maxWidth ?? undefined,
      flexShrink: 0,
    }),
    [],
  );

  // ── Render a single table row ─────────────────────────────────────────
  const renderRow = useCallback(
    (row, index) => (
      <TableRow
        key={rowKey(row, index)}
        hover={Boolean(onRowClick)}
        onClick={onRowClick ? () => onRowClick(row, index) : undefined}
        sx={{
          cursor: onRowClick ? 'pointer' : 'default',
          height: rowHeight,
          // Ensure consistent row height when virtualizing
          boxSizing: 'border-box',
        }}
      >
        {columns.map((col) => {
          const value = row[col.field];
          return (
            <TableCell key={col.field} sx={cellSx(col)}>
              {col.renderCell ? col.renderCell(value, row, index) : value}
            </TableCell>
          );
        })}
      </TableRow>
    ),
    [columns, onRowClick, rowHeight, rowKey, cellSx],
  );

  // ── Fixed header ──────────────────────────────────────────────────────
  const headerRow = useMemo(
    () => (
      <TableHead>
        <TableRow>
          {columns.map((col) => (
            <TableCell
              key={col.field}
              sx={{
                fontWeight: 600,
                backgroundColor: 'background.paper',
                ...cellSx(col),
              }}
            >
              {col.headerName}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
    ),
    [columns, cellSx],
  );

  // ── Non-virtualized fallback for small datasets ───────────────────────
  if (rows.length < threshold) {
    return (
      <TableContainer
        component={Box}
        sx={{ maxHeight, overflow: 'auto', ...sx }}
      >
        <Table stickyHeader size="small">
          {headerRow}
          <TableBody>
            {rows.map((row, index) => renderRow(row, index))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  // ── Virtualization calculations ───────────────────────────────────────
  const totalHeight = rows.length * rowHeight;

  // Determine which rows fall inside the visible viewport.
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / rowHeight) - overscanCount,
  );
  const visibleCount = Math.ceil(maxHeight / rowHeight);
  const endIndex = Math.min(
    rows.length,
    Math.floor(scrollTop / rowHeight) + visibleCount + overscanCount,
  );

  const offsetY = startIndex * rowHeight;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <TableContainer
      component={Box}
      ref={bodyRef}
      onScroll={handleScroll}
      sx={{ maxHeight, overflow: 'auto', ...sx }}
    >
      <Table stickyHeader size="small">
        {headerRow}
        <TableBody>
          {/* Top spacer row to push visible rows into the correct position */}
          {offsetY > 0 && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                sx={{
                  height: offsetY,
                  padding: 0,
                  border: 'none',
                }}
              />
            </TableRow>
          )}

          {/* Visible rows */}
          {rows.slice(startIndex, endIndex).map((row, i) =>
            renderRow(row, startIndex + i),
          )}

          {/* Bottom spacer row to maintain correct scrollbar size */}
          {endIndex < rows.length && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                sx={{
                  height: (rows.length - endIndex) * rowHeight,
                  padding: 0,
                  border: 'none',
                }}
              />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default VirtualizedTable;
