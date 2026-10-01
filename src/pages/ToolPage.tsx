import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ToolWorkspace } from '@/components/ToolWorkspace';
import { EmptyState, PageLoader } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { canUseTool, getTool } from '@/lib/tools';
import { toolLoaders } from '@/tools/registry';
import type { ToolModule } from '@/tools/types';

export default function ToolPage() {
  const { toolId } = useParams();
  const { profile } = useAuth();
  const meta = getTool(toolId);
  const [module, setModule] = useState<{ id: string; mod: ToolModule } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!toolId || !toolLoaders[toolId]) return;
    let active = true;
    setFailed(false);
    toolLoaders[toolId]()
      .then((m) => active && setModule({ id: toolId, mod: m.default }))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [toolId]);

  if (!meta) return <EmptyState icon={<Lock className="h-6 w-6" />} title="Tool not found" action={<Link to="/app" className="btn btn-primary">Back to dashboard</Link>} />;
  if (!canUseTool(profile?.role, meta)) {
    return (
      <EmptyState
        icon={<Lock className="h-6 w-6" />}
        title={`This is a ${meta.role} tool`}
        text={`${meta.name} is available to ${meta.role} accounts.`}
        action={<Link to="/app" className="btn btn-primary">Back to dashboard</Link>}
      />
    );
  }
  if (failed) return <EmptyState icon={<Lock className="h-6 w-6" />} title="Could not load this tool" text="Please refresh the page." />;
  if (!module || module.id !== toolId) return <PageLoader />;
  return <ToolWorkspace key={toolId} meta={meta} module={module.mod} />;
}
