import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { classNames } from '../lib/utils';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; type: ToastType; message: string }

const ToastContext = createContext<(type: ToastType, message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const remove = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto">
        {toasts.map((t) => {
          const Icon = t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertCircle : Info;
          const tone =
            t.type === 'success' ? 'text-forest-600' : t.type === 'error' ? 'text-clay-600' : 'text-ink-600';
          return (
            <div
              key={t.id}
              className="flex items-start gap-3 bg-white rounded-xl shadow-lift border border-ink-100 px-4 py-3 animate-fade-up"
            >
              <Icon size={20} className={classNames('mt-0.5 shrink-0', tone)} />
              <p className="text-sm text-ink-800 flex-1">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                className="text-ink-400 hover:text-ink-700 transition-colors"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
