import { Sprout } from 'lucide-react';
import { classNames } from '../lib/utils';

export function Logo({ size = 'md', withText = true }: { size?: 'sm' | 'md' | 'lg'; withText?: boolean }) {
  const dim = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  const icon = size === 'sm' ? 18 : size === 'lg' ? 26 : 22;
  const text = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';
  return (
    <div className="flex items-center gap-2.5">
      <div className={classNames('rounded-xl bg-forest-600 text-white flex items-center justify-center shadow-soft', dim)}>
        <Sprout size={icon} strokeWidth={2.4} />
      </div>
      {withText && (
        <span className={classNames('font-extrabold tracking-tight text-ink-900', text)}>
          Rooted
        </span>
      )}
    </div>
  );
}
