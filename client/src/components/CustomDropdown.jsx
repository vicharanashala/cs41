import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Dark-themed custom dropdown.
 * Replaces native <select> elements that can't be reliably styled
 * for dark-theme consistency across browsers and OSes.
 *
 * Props:
 *   value       — currently selected value
 *   options     — array of { value, label } or plain strings
 *   onChange    — (value) => void
 *   placeholder — shown when no value is selected
 *   triggerClassName — optional extra classes for the trigger button
 */
export function CustomDropdown({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  triggerClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const normalized = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  );

  const selected = normalized.find((o) => o.value === value);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen((v) => !v); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`input-field flex items-center justify-between gap-3 cursor-pointer w-full ${triggerClassName}`}
      >
        <span className={selected ? 'text-[#e2e2ff]' : 'text-gray-500'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-500 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            role="listbox"
            className="absolute top-full left-0 right-0 mt-1.5 z-50 overflow-hidden rounded-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.55)]"
            style={{ background: 'rgba(18, 18, 31, 0.98)', backdropFilter: 'blur(12px)' }}
          >
            {normalized.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                onClick={() => handleSelect(opt.value)}
                className={`
                  px-3 py-2.5 cursor-pointer flex items-center justify-between gap-2 text-sm
                  transition-colors select-none
                  ${opt.value === value ? 'bg-white/[0.05]' : 'hover:bg-white/[0.04]'}
                  ${i !== 0 ? 'border-t border-white/[0.04]' : ''}
                `}
              >
                <span className={opt.value === value ? 'text-[#e2e2ff]' : 'text-gray-300'}>
                  {opt.label}
                </span>
                {opt.value === value && (
                  <Check size={12} className="text-secondary flex-shrink-0" />
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}