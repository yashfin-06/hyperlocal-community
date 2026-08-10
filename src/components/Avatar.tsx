import { classNames, colorFromString, initials } from '../lib/utils';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const sizeCls = sizeMap[size];
  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={classNames('rounded-full object-cover ring-1 ring-ink-100', sizeCls, className)}
      />
    );
  }
  return (
    <div
      className={classNames(
        'rounded-full flex items-center justify-center font-semibold text-white ring-1 ring-black/5',
        colorFromString(name || 'X'),
        sizeCls,
        className,
      )}
      aria-label={name || 'User avatar'}
    >
      {initials(name || '?')}
    </div>
  );
}
