import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Shared horizontal stepper for the Add-X wizards. Purely presentational —
// the parent owns currentStep and step data.
export interface StepperStep { key: string; label: string; }

interface StepperProps {
  steps: StepperStep[];
  current: number; // 0-indexed
  onStepClick?: (index: number) => void; // allow jumping back to completed steps
  className?: string;
}

export function Stepper({ steps, current, onStepClick, className }: StepperProps) {
  return (
    <div className={cn('flex items-center w-full', className)}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = onStepClick && i <= current;
        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(i)}
              className={cn('flex items-center gap-2 group', clickable && 'cursor-pointer')}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2 transition-colors flex-shrink-0',
                  done && 'bg-[#791E75] border-[#791E75] text-white',
                  active && 'border-[#791E75] text-[#791E75] bg-[#791E75]/5',
                  !done && !active && 'border-gray-300 text-gray-400',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-sm font-medium hidden sm:inline whitespace-nowrap',
                  active ? 'text-[#791E75]' : done ? 'text-gray-700' : 'text-gray-400',
                )}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={cn('h-0.5 flex-1 mx-2 sm:mx-3 rounded', i < current ? 'bg-[#791E75]' : 'bg-gray-200')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
