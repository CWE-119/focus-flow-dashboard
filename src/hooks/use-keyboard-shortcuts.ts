import { useEffect } from 'react';

interface KeyboardShortcuts {
  onNewNote?: () => void;
  onNewFolder?: () => void;
  onNewReminder?: () => void;
  onSave?: () => void;
  onSearch?: () => void;
  onEscape?: () => void;
  onToggleFolders?: () => void;
  onToggleNotesList?: () => void;
  // Timer shortcuts
  onTimerToggle?: () => void;
  onTimerReset?: () => void;
  onTimerSave?: () => void;
  // Navigation
  onGoDashboard?: () => void;
  onGoNotes?: () => void;
  onGoCanvas?: () => void;
  onGoHelp?: () => void;
  // Misc
  onNewTask?: () => void;
  onCycleTheme?: () => void;
  onShowShortcuts?: () => void;
}

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
};

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcuts) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: New Note
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        shortcuts.onNewNote?.();
      }
      
      // Ctrl/Cmd + Shift + N: New Folder
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        shortcuts.onNewFolder?.();
      }
      
      // Ctrl/Cmd + Shift + R: New Reminder
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        shortcuts.onNewReminder?.();
      }
      
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        shortcuts.onSave?.();
      }
      
      // Ctrl/Cmd + K: Search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        shortcuts.onSearch?.();
      }
      
      // Ctrl/Cmd + B: Toggle Folders Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        shortcuts.onToggleFolders?.();
      }
      
      // Ctrl/Cmd + L: Toggle Notes List
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        shortcuts.onToggleNotesList?.();
      }
      
      // Space: Toggle Timer (when not in input/textarea)
      if (e.code === 'Space' && shortcuts.onTimerToggle) {
        const target = e.target as HTMLElement;
        const isInputField = target.tagName === 'INPUT' || 
                            target.tagName === 'TEXTAREA' || 
                            target.isContentEditable;
        if (!isInputField) {
          e.preventDefault();
          shortcuts.onTimerToggle();
        }
      }
      
      // Ctrl/Cmd + Shift + S: Save Timer Session
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        shortcuts.onTimerSave?.();
      }
      
      // Ctrl/Cmd + R: Reset Timer (prevent browser refresh)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'r' && shortcuts.onTimerReset) {
        e.preventDefault();
        shortcuts.onTimerReset();
      }

      // Alt + 1/2/3/0: navigation
      if (e.altKey && !e.ctrlKey && !e.metaKey && !isTypingTarget(e.target)) {
        if (e.key === '1' && shortcuts.onGoDashboard) {
          e.preventDefault();
          shortcuts.onGoDashboard();
        }
        if (e.key === '2' && shortcuts.onGoNotes) {
          e.preventDefault();
          shortcuts.onGoNotes();
        }
        if (e.key === '3' && shortcuts.onGoCanvas) {
          e.preventDefault();
          shortcuts.onGoCanvas();
        }
        if ((e.key === '0' || e.key === '/') && shortcuts.onGoHelp) {
          e.preventDefault();
          shortcuts.onGoHelp();
        }
      }

      // Ctrl/Cmd + J: New Task
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j' && shortcuts.onNewTask) {
        e.preventDefault();
        shortcuts.onNewTask();
      }

      // Ctrl/Cmd + Shift + T: Cycle theme
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't' && shortcuts.onCycleTheme) {
        e.preventDefault();
        shortcuts.onCycleTheme();
      }

      // Shift + ? or Ctrl/Cmd + /: Show shortcuts
      if (shortcuts.onShowShortcuts && !isTypingTarget(e.target)) {
        if (e.key === '?' || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
          e.preventDefault();
          shortcuts.onShowShortcuts();
        }
      }

      // Escape: Close dialogs
      if (e.key === 'Escape') {
        shortcuts.onEscape?.();
      }

    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};