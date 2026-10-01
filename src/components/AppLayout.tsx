import clsx from 'clsx';
import { BookOpen, ChartColumn, ChevronDown, LayoutDashboard, Library, LogOut, Menu, Settings, Shield, User, Users, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { STUDENT_TOOLS, TEACHER_TOOLS, type ToolMeta } from '@/lib/tools';
import { Logo } from './Logo';

function NavItem({ to, icon, children, end }: { to: string; icon: ReactNode; children: ReactNode; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
          isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </NavLink>
  );
}

function ToolGroup({ title, tools, defaultOpen }: { title: string; tools: ToolMeta[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="mb-1 flex w-full items-center justify-between px-3 pt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600"
      >
        {title}
        <ChevronDown className={clsx('h-3.5 w-3.5 transition', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="space-y-0.5">
          {tools.map((t) => (
            <NavItem key={t.id} to={`/tools/${t.id}`} icon={<t.icon className="h-[18px] w-[18px]" />}>
              {t.name}
            </NavItem>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const role = profile?.role;
  const initials = (profile?.full_name || profile?.email || '?').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <NavLink to="/app">
          <Logo size={34} />
        </NavLink>
        <button className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 scrollbar-thin">
        <NavItem to="/app" end icon={<LayoutDashboard className="h-[18px] w-[18px]" />}>Dashboard</NavItem>
        <NavItem to="/library" icon={<Library className="h-[18px] w-[18px]" />}>My Library</NavItem>
        <NavItem to="/materials" icon={<BookOpen className="h-[18px] w-[18px]" />}>My materials</NavItem>
        {role === 'admin' && (
          <>
            <div className="px-3 pt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Administration</div>
            <NavItem to="/admin" end icon={<ChartColumn className="h-[18px] w-[18px]" />}>Overview</NavItem>
            <NavItem to="/admin/users" icon={<Users className="h-[18px] w-[18px]" />}>Users</NavItem>
            <NavItem to="/admin/settings" icon={<Settings className="h-[18px] w-[18px]" />}>AI Settings</NavItem>
          </>
        )}
        {(role === 'teacher' || role === 'admin') && <ToolGroup title="Teacher tools" tools={TEACHER_TOOLS} defaultOpen={role === 'teacher'} />}
        {(role === 'student' || role === 'admin') && <ToolGroup title="Student tools" tools={STUDENT_TOOLS} defaultOpen={role === 'student'} />}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <NavLink to="/profile" className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-100">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-fuchsia-500 text-sm font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900">{profile?.full_name || 'Account'}</div>
            <div className="flex items-center gap-1 text-xs capitalize text-slate-500">
              {role === 'admin' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />} {role}
            </div>
          </div>
        </NavLink>
        <button
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600"
          onClick={async () => {
            await signOut();
            navigate('/');
          }}
        >
          <LogOut className="h-[18px] w-[18px]" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-fade-in bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-72">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:hidden">
          <button className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Logo size={28} />
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
