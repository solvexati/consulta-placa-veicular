import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import type { AuthUser } from '../hooks/useAuth';
import { haptic } from '../utils/format';

export default function UserMenu({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          haptic();
          setOpen((o) => !o);
        }}
        className="tap flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
        aria-label={`Conta de ${user.name}`}
        aria-expanded={open}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full ring-2 ring-white/30" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-xs font-bold">{initials}</span>
        )}
      </button>

      {open && (
        <div className="animate-pop absolute top-12 right-0 z-50 w-64 overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl ring-1 ring-slate-200">
          <div className="border-b border-slate-100 p-4">
            <p className="truncate font-bold">{user.name}</p>
            <p className="truncate text-sm text-slate-500">{user.email}</p>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="tap flex h-12 w-full items-center gap-2 px-4 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Sair da conta
          </button>
        </div>
      )}
    </div>
  );
}
