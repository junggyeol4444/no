import WorkSettings from "@/components/WorkSettings";
import { parseId } from "@/lib/http";
import { getWork } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function SettingsPage({
  params,
}: {
  params: { workId: string };
}) {
  const workId = parseId(params.workId)!;
  const work = getWork(workId)!;
  return <WorkSettings work={work} />;
}
