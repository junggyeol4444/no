import WorldManager from "@/components/WorldManager";
import { parseId } from "@/lib/http";
import { listWorldSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function WorldPage({ params }: { params: { workId: string } }) {
  const workId = parseId(params.workId)!;
  const settings = listWorldSettings(workId);
  return <WorldManager workId={workId} initial={settings} />;
}
