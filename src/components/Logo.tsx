import clsx from 'clsx';

export function Logo({ size = 36, withText = true, className, light }: { size?: number; withText?: boolean; className?: string; light?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <img src="/logo.png" alt="Tutorix" width={size} height={size} className="shrink-0" style={{ width: size, height: size }} />
      {withText && (
        <span className={clsx('font-display text-xl font-extrabold tracking-tight', light ? 'text-white' : 'text-slate-900')}>
          Tutor<span className="bg-gradient-to-r from-brand-600 to-fuchsia-600 bg-clip-text text-transparent">ix</span>
        </span>
      )}
    </span>
  );
}
