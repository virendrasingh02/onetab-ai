import { useCallback, useEffect, useState } from 'react';

const LAYOUT_STORAGE_KEY = 'onetab_layout_preferences_v1';

export interface LayoutBounds {
  leftMin: number;
  leftMax: number;
  leftDefault: number;
  rightMin: number;
  rightMax: number;
  rightDefault: number;
}

export const DEFAULT_LAYOUT_BOUNDS: LayoutBounds = {
  leftMin: 180,
  leftMax: 480,
  leftDefault: 240,
  rightMin: 260,
  rightMax: 600,
  rightDefault: 320,
};

export interface StoredLayoutConfig {
  leftWidth: number;
  rightWidth: number;
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
}

export interface UseResizableLayoutOptions {
  bounds?: Partial<LayoutBounds>;
}

export function useResizableLayout(options: UseResizableLayoutOptions = {}) {
  const bounds: LayoutBounds = {
    ...DEFAULT_LAYOUT_BOUNDS,
    ...options.bounds,
  };

  // Safe initial load from localStorage
  const getInitialState = (): StoredLayoutConfig => {
    try {
      const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          leftWidth: typeof parsed.leftWidth === 'number'
            ? Math.min(Math.max(parsed.leftWidth, bounds.leftMin), bounds.leftMax)
            : bounds.leftDefault,
          rightWidth: typeof parsed.rightWidth === 'number'
            ? Math.min(Math.max(parsed.rightWidth, bounds.rightMin), bounds.rightMax)
            : bounds.rightDefault,
          sidebarOpen: typeof parsed.sidebarOpen === 'boolean' ? parsed.sidebarOpen : true,
          rightPanelOpen: typeof parsed.rightPanelOpen === 'boolean' ? parsed.rightPanelOpen : true,
        };
      }
    } catch (e) {
      console.warn('Failed to load saved layout preferences:', e);
    }
    return {
      leftWidth: bounds.leftDefault,
      rightWidth: bounds.rightDefault,
      sidebarOpen: true,
      rightPanelOpen: true,
    };
  };

  const [initial] = useState<StoredLayoutConfig>(getInitialState);

  const [leftWidth, setLeftWidth] = useState<number>(initial.leftWidth);
  const [rightWidth, setRightWidth] = useState<number>(initial.rightWidth);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(initial.sidebarOpen);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(initial.rightPanelOpen);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);

  // Save to localStorage whenever dimensions or toggle states change
  useEffect(() => {
    try {
      const config: StoredLayoutConfig = {
        leftWidth,
        rightWidth,
        sidebarOpen,
        rightPanelOpen,
      };
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to persist layout preferences:', e);
    }
  }, [leftWidth, rightWidth, sidebarOpen, rightPanelOpen]);

  // Recalculate widths if screen becomes smaller than max allowed
  useEffect(() => {
    const handleResize = () => {
      const windowWidth = window.innerWidth;
      const maxSideWidth = Math.floor(windowWidth * 0.45);

      setLeftWidth((prev) => {
        const effectiveMax = Math.min(bounds.leftMax, maxSideWidth);
        if (prev > effectiveMax && effectiveMax >= bounds.leftMin) {
          return effectiveMax;
        }
        return prev;
      });

      setRightWidth((prev) => {
        const effectiveMax = Math.min(bounds.rightMax, maxSideWidth);
        if (prev > effectiveMax && effectiveMax >= bounds.rightMin) {
          return effectiveMax;
        }
        return prev;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [bounds.leftMax, bounds.leftMin, bounds.rightMax, bounds.rightMin]);

  // Left sidebar dragging
  const startLeftResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizing('left');

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const newWidth = moveEvent.clientX;
      const maxAllowed = Math.min(bounds.leftMax, Math.floor(window.innerWidth * 0.45));
      const clamped = Math.min(Math.max(newWidth, bounds.leftMin), maxAllowed);
      setLeftWidth(clamped);
    };

    const handlePointerUp = () => {
      setIsResizing(null);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [bounds.leftMax, bounds.leftMin]);

  // Right sidebar dragging
  const startRightResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizing('right');

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const windowWidth = window.innerWidth;
      const newWidth = windowWidth - moveEvent.clientX;
      const maxAllowed = Math.min(bounds.rightMax, Math.floor(windowWidth * 0.45));
      const clamped = Math.min(Math.max(newWidth, bounds.rightMin), maxAllowed);
      setRightWidth(clamped);
    };

    const handlePointerUp = () => {
      setIsResizing(null);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [bounds.rightMax, bounds.rightMin]);

  const resetLeftWidth = useCallback(() => {
    setLeftWidth(bounds.leftDefault);
  }, [bounds.leftDefault]);

  const resetRightWidth = useCallback(() => {
    setRightWidth(bounds.rightDefault);
  }, [bounds.rightDefault]);

  const stepLeftWidth = useCallback((delta: number) => {
    setLeftWidth((prev) => {
      const maxAllowed = Math.min(bounds.leftMax, Math.floor(window.innerWidth * 0.45));
      return Math.min(Math.max(prev + delta, bounds.leftMin), maxAllowed);
    });
  }, [bounds.leftMax, bounds.leftMin]);

  const stepRightWidth = useCallback((delta: number) => {
    setRightWidth((prev) => {
      const maxAllowed = Math.min(bounds.rightMax, Math.floor(window.innerWidth * 0.45));
      return Math.min(Math.max(prev + delta, bounds.rightMin), maxAllowed);
    });
  }, [bounds.rightMax, bounds.rightMin]);

  return {
    leftWidth,
    rightWidth,
    sidebarOpen,
    rightPanelOpen,
    isResizing,
    bounds,
    setSidebarOpen,
    setRightPanelOpen,
    startLeftResize,
    startRightResize,
    resetLeftWidth,
    resetRightWidth,
    stepLeftWidth,
    stepRightWidth,
  };
}
