import clsx from 'clsx';
import { CircleCheck, CircleX, Info } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Kind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: Kind; message: string }

const ToastCtx = createContext<(message: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, kind, message }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(92vw,380px)] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex animate-fade-in items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-lg',
              t.kind === 'error' ? 'border-rose-200' : t.kind === 'info' ? 'border-sky-200' : 'border-emerald-200',
            )}
          >
            {t.kind === 'error' ? <CircleX className="h-5 w-5 shrink-0 text-rose-500" /> : t.kind === 'info' ? <Info className="h-5 w-5 shrink-0 text-sky-500" /> : <CircleCheck className="h-5 w-5 shrink-0 text-emerald-500" />}
            <span className="text-slate-700">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
