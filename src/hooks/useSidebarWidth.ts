import { useCallback, useEffect, useState } from 'react';

const COLLAPSED_STORAGE_KEY = 'helios-sidebar-collapsed';

export const SIDEBAR_WIDTH = 288;
export const SIDEBAR_COLLAPSED_WIDTH = 80;

function readStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
}

export function useSidebarWidth() {
  const [isCollapsed, setIsCollapsed] = useState(readStoredCollapsed);

  const effectiveWidth = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${effectiveWidth}px`);
    return () => {
      document.documentElement.style.removeProperty('--sidebar-width');
    };
  }, [effectiveWidth]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((current) => {
      const next = !current;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return {
    width: effectiveWidth,
    expandedWidth: SIDEBAR_WIDTH,
    isCollapsed,
    toggleCollapse,
  };
}
