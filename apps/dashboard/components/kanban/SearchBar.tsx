/**
 * SearchBar Component
 *
 * Search input component with debounced input and clear button.
 * Filters tasks by description and tags.
 *
 * Design: Minimalist search bar with amber accent on focus
 */

'use client';

import { Search, X } from 'lucide-react';
import { ChangeEvent, KeyboardEvent, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search tasks by description or tags...',
  className,
}: SearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, 300);

  // Sync debounced value with parent
  useEffect(() => {
    onChange(debouncedValue);
  }, [debouncedValue, onChange]);

  // Sync local value with external changes
  useEffect(() => {
    if (value !== localValue && localValue === debouncedValue) {
      setLocalValue(value);
    }
  }, [value, localValue, debouncedValue]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  const handleClear = () => {
    setLocalValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className={cn('relative w-full', className)}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none">
        <Search className="h-4 w-4" />
      </div>
      <Input
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pl-10 pr-10"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 transition-colors"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
