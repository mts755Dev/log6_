import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills';
}

export function Tabs({ tabs, activeTab, onChange, variant = 'default' }: TabsProps) {
  if (variant === 'pills') {
    return (
      <div className="inline-flex bg-slate-900/50 border border-slate-800 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === tab.id
                ? 'text-white'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="active-pill"
                className="absolute inset-0 bg-slate-800 rounded-lg"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded-full">
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="border-b border-slate-800">
      <nav className="flex gap-1 -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative px-4 py-3 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'text-primary-400'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <span className="flex items-center gap-2">
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-primary-600/20 text-primary-400 rounded-full">
                  {tab.badge}
                </span>
              )}
            </span>
            {activeTab === tab.id && (
              <motion.div
                layoutId="active-tab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

interface TabPanelsProps {
  children: React.ReactNode;
  activeTab: string;
}

export function TabPanels({ children, activeTab }: TabPanelsProps) {
  const panels = Array.isArray(children) ? children : [children];

  return (
    <div className="mt-6">
      {panels.map((panel, index) => {
        const panelId = (panel as React.ReactElement).props?.id;
        if (panelId !== activeTab) return null;

        return (
          <motion.div
            key={panelId || index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {panel}
          </motion.div>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  id: string;
  children: React.ReactNode;
}

export function TabPanel({ children }: TabPanelProps) {
  return <>{children}</>;
}

