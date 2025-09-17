/**
 * Accessibility utilities for improving user experience
 */

/**
 * Generate ARIA labels for chart elements
 */
export function generateChartAriaLabel(
  chartType: string,
  dataPoint: any,
  index: number,
  total: number
): string {
  const { dateFormatted, value } = dataPoint;
  return `${chartType} chart, point ${index + 1} of ${total}: ${dateFormatted}, value ${value}`;
}

/**
 * Generate ARIA labels for KPI cards
 */
export function generateKPIAriaLabel(
  title: string,
  value: string,
  progress: number
): string {
  return `${title}: ${value}, ${progress.toFixed(1)}% complete`;
}

/**
 * Generate ARIA labels for table cells
 */
export function generateTableCellAriaLabel(
  columnHeader: string,
  cellValue: string,
  rowIndex: number
): string {
  return `Row ${rowIndex + 1}, ${columnHeader}: ${cellValue}`;
}

/**
 * Generate ARIA labels for buttons
 */
export function generateButtonAriaLabel(
  action: string,
  context?: string
): string {
  return context ? `${action} ${context}` : action;
}

/**
 * Generate ARIA descriptions for complex UI elements
 */
export function generateAriaDescription(element: string): string {
  const descriptions: Record<string, string> = {
    workProgress: 'Shows current work day progress and time remaining until end of work day',
    familyLeave: 'Shows family leave progress and time remaining until family leave period ends',
    retirement: 'Shows retirement progress and time remaining until retirement period ends',
    stockChart: 'Interactive chart showing stock value progression over time with target lines',
    eunlChart: 'Interactive chart showing EUNL ETF price history with trend analysis',
    contributionsChart: 'Interactive chart showing minimum required monthly contributions to reach investment goals',
    conditionsTable: 'Table showing reward conditions and their descriptions',
    viewModeToggle: 'Toggle between different data view modes: recorded range, next 2 years, or full range',
  };

  return descriptions[element] || `Interactive ${element} component`;
}

/**
 * Check if element should be focusable based on visibility and state
 */
export function shouldBeFocusable(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const isVisible = style.visibility !== 'hidden' && style.display !== 'none';
  const hasTabIndex = element.tabIndex >= 0;
  
  return isVisible && (hasTabIndex || element.tagName === 'BUTTON' || element.tagName === 'A' || element.tagName === 'INPUT');
}

/**
 * Focus management utilities
 */
export class FocusManager {
  private static instance: FocusManager;
  private focusHistory: HTMLElement[] = [];

  static getInstance(): FocusManager {
    if (!FocusManager.instance) {
      FocusManager.instance = new FocusManager();
    }
    return FocusManager.instance;
  }

  saveFocus(element?: HTMLElement): void {
    const targetElement = element || document.activeElement as HTMLElement;
    if (targetElement && shouldBeFocusable(targetElement)) {
      this.focusHistory.push(targetElement);
    }
  }

  restoreFocus(): void {
    const lastElement = this.focusHistory.pop();
    if (lastElement && shouldBeFocusable(lastElement)) {
      lastElement.focus();
    }
  }

  clearHistory(): void {
    this.focusHistory = [];
  }
}

/**
 * Keyboard navigation utilities
 */
export const KEYBOARD_NAVIGATION = {
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  HOME: 'Home',
  END: 'End',
} as const;

/**
 * Handle keyboard navigation for chart elements
 */
export function handleChartKeyboardNavigation(
  event: KeyboardEvent,
  currentIndex: number,
  totalItems: number,
  onNavigate: (index: number) => void
): void {
  switch (event.key) {
    case KEYBOARD_NAVIGATION.ARROW_LEFT:
    case KEYBOARD_NAVIGATION.ARROW_UP:
      event.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : totalItems - 1;
      onNavigate(prevIndex);
      break;
    case KEYBOARD_NAVIGATION.ARROW_RIGHT:
    case KEYBOARD_NAVIGATION.ARROW_DOWN:
      event.preventDefault();
      const nextIndex = currentIndex < totalItems - 1 ? currentIndex + 1 : 0;
      onNavigate(nextIndex);
      break;
    case KEYBOARD_NAVIGATION.HOME:
      event.preventDefault();
      onNavigate(0);
      break;
    case KEYBOARD_NAVIGATION.END:
      event.preventDefault();
      onNavigate(totalItems - 1);
      break;
  }
}

/**
 * Generate screen reader announcements
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Screen reader only class for visually hidden content
 */
export const SR_ONLY_CLASS = 'sr-only';
