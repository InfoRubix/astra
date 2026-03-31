import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { List, ListItem, Box } from '@mui/material';

/**
 * Default threshold below which we render a plain MUI List
 * instead of virtualizing (the overhead is not worth it).
 */
const VIRTUALIZATION_THRESHOLD = 50;

/**
 * A reusable virtualized list component that wraps MUI's List.
 *
 * For small datasets (< 50 items by default) it renders a plain MUI List.
 * For larger datasets it only renders the items that are visible inside the
 * scrollable container plus an overscan buffer, using CSS transforms for
 * positioning. This avoids adding any extra dependencies.
 *
 * Variable-height items are supported through an estimated-height model:
 * each item starts at `itemHeight` (the estimate) and its actual rendered
 * height is measured and cached so that subsequent renders / scroll
 * calculations are accurate.
 *
 * @param {object}   props
 * @param {Array}    props.items          - The full array of data items.
 * @param {Function} props.renderItem     - (item, index) => ReactNode renderer.
 * @param {number}   [props.itemHeight=48]  - Estimated pixel height per item.
 * @param {number}   [props.height=400]     - Pixel height of the scrollable viewport.
 * @param {number}   [props.overscanCount=5] - Extra items to render above/below viewport.
 * @param {number}   [props.threshold]       - Item count below which virtualization is skipped.
 * @param {object}   [props.listProps]       - Extra props forwarded to the MUI <List>.
 * @param {object}   [props.sx]              - MUI sx prop applied to the outer container.
 */
const VirtualizedList = ({
  items = [],
  renderItem,
  itemHeight = 48,
  height = 400,
  overscanCount = 5,
  threshold = VIRTUALIZATION_THRESHOLD,
  listProps = {},
  sx = {},
}) => {
  // ── Refs ──────────────────────────────────────────────────────────────
  const containerRef = useRef(null);

  /**
   * Cache of measured heights keyed by item index.
   * Using a ref so mutations don't trigger re-renders; the scroll handler
   * reads the latest values on every tick.
   */
  const measuredHeights = useRef({});

  // ── State ─────────────────────────────────────────────────────────────
  const [scrollTop, setScrollTop] = useState(0);

  // ── Fallback: render a plain list for small datasets ─────────────────
  if (items.length < threshold) {
    return (
      <List
        sx={{ maxHeight: height, overflow: 'auto', ...sx }}
        {...listProps}
      >
        {items.map((item, index) => (
          <ListItem key={index} disablePadding>
            {renderItem(item, index)}
          </ListItem>
        ))}
      </List>
    );
  }

  // ── Height helpers ────────────────────────────────────────────────────

  /**
   * Return the height to use for a given index.
   * If the item has been measured we use that value, otherwise fall back
   * to the estimated `itemHeight`.
   */
  const getItemHeight = (index) => {
    return measuredHeights.current[index] ?? itemHeight;
  };

  /**
   * Compute the sum of heights for items in [0, index).
   * This gives us the top-offset for the item at `index`.
   */
  const getOffsetForIndex = (index) => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(i);
    }
    return offset;
  };

  /**
   * Total height of all items (known measured + estimated remaining).
   */
  const getTotalHeight = () => {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
      total += getItemHeight(i);
    }
    return total;
  };

  // ── Visible range calculation ─────────────────────────────────────────

  /**
   * Determine the start and end indices that should be rendered given the
   * current `scrollTop` value, the viewport `height`, and `overscanCount`.
   */
  const getVisibleRange = () => {
    let offset = 0;
    let startIndex = 0;

    // Find the first item whose bottom edge is past scrollTop.
    while (startIndex < items.length) {
      const h = getItemHeight(startIndex);
      if (offset + h > scrollTop) break;
      offset += h;
      startIndex++;
    }

    // Walk forward until we've filled the viewport.
    let endIndex = startIndex;
    let visibleHeight = 0;
    while (endIndex < items.length && visibleHeight < height) {
      visibleHeight += getItemHeight(endIndex);
      endIndex++;
    }

    // Apply overscan.
    const overscanStart = Math.max(0, startIndex - overscanCount);
    const overscanEnd = Math.min(items.length, endIndex + overscanCount);

    return { startIndex: overscanStart, endIndex: overscanEnd };
  };

  const { startIndex, endIndex } = getVisibleRange();
  const totalHeight = getTotalHeight();
  const offsetY = getOffsetForIndex(startIndex);

  // ── Scroll handler ────────────────────────────────────────────────────

  const handleScroll = (e) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      sx={{
        height,
        overflow: 'auto',
        position: 'relative',
        ...sx,
      }}
    >
      {/* Spacer that keeps the scrollbar the correct total size */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Positioned slice of visible items */}
        <List
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            transform: `translateY(${offsetY}px)`,
            padding: 0,
          }}
          {...listProps}
        >
          {items.slice(startIndex, endIndex).map((item, i) => {
            const actualIndex = startIndex + i;
            return (
              <MeasuredListItem
                key={actualIndex}
                index={actualIndex}
                measuredHeights={measuredHeights}
              >
                {renderItem(item, actualIndex)}
              </MeasuredListItem>
            );
          })}
        </List>
      </div>
    </Box>
  );
};

/**
 * Wrapper around each rendered item that measures its DOM height after
 * mount / update and stores the value in the shared `measuredHeights` ref.
 * This enables accurate positioning for variable-height items without
 * requiring the consumer to know heights ahead of time.
 *
 * @param {object} props
 * @param {number} props.index            - Item index in the full list.
 * @param {object} props.measuredHeights  - Shared ref object for caching heights.
 * @param {React.ReactNode} props.children
 */
const MeasuredListItem = ({ index, measuredHeights, children }) => {
  const itemRef = useRef(null);

  useEffect(() => {
    if (itemRef.current) {
      const measured = itemRef.current.getBoundingClientRect().height;
      if (measured > 0) {
        measuredHeights.current[index] = measured;
      }
    }
  });

  return (
    <ListItem ref={itemRef} disablePadding>
      {children}
    </ListItem>
  );
};

export default VirtualizedList;
