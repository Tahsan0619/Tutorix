import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo size={48} withText={false} />
      <h1 className="text-5xl font-extrabold text-slate-900">404</h1>
      <p className="text-slate-500">This page does not exist.</p>
      <Link to="/" className="btn btn-primary">Go home</Link>
    </div>
  );
}
