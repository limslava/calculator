import { useEffect, useMemo, useRef, useState } from 'react';

export type MultiSelectProps = {
  id?: string;
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
};

export default function MultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
  placeholder = 'Все',
  className
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const triggerLabel = useMemo(() => {
    if (!selected.length) return placeholder;
    if (selected.length === 1) return selected[0];
    return `Выбрано: ${selected.length}`;
  }, [placeholder, selected]);

  const filteredOptions = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) return options;
    return options.filter(option => option.toLowerCase().includes(lower));
  }, [options, query]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const toggleValue = (value: string, checked: boolean) => {
    if (checked) {
      if (!selected.includes(value)) {
        onChange([...selected, value]);
      }
    } else {
      onChange(selected.filter(item => item !== value));
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <div
      id={id}
      ref={containerRef}
      className={`trd-multiselect ${isOpen ? 'is-open' : ''} ${className || ''}`.trim()}
      data-filter={label.toLowerCase()}
    >
      <button
        type="button"
        className="trd-ms-trigger"
        onClick={event => {
          event.stopPropagation();
          setIsOpen(prev => !prev);
        }}
      >
        {triggerLabel}
      </button>
      <div className="trd-ms-panel" onClick={event => event.stopPropagation()}>
        <div className="trd-ms-controls">
          <input
            type="text"
            className="trd-ms-search"
            placeholder="Поиск..."
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <div className="trd-ms-actions">
            <button type="button" className="trd-ms-action" onClick={handleClear}>
              Сбросить
            </button>
          </div>
        </div>
        <div className="trd-ms-options">
          {filteredOptions.length === 0 && (
            <div className="trd-ms-empty">Нет совпадений</div>
          )}
          {filteredOptions.map(option => (
            <label key={option} className="trd-ms-option">
              <input
                type="checkbox"
                value={option}
                checked={selected.includes(option)}
                onChange={event => toggleValue(option, event.target.checked)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
