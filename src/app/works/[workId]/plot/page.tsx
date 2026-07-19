import PlotTimeline from "@/components/PlotTimeline";
import { parseId } from "@/lib/http";
import { listChapters, listPlotPoints, listTimeline } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function PlotPage({ params }: { params: { workId: string } }) {
  const workId = parseId(params.workId)!;
  const chapters = listChapters(workId).map((c) => ({
    id: c.id,
    number: c.number,
    title: c.title,
  }));
  return (
    <PlotTimeline
      workId={workId}
      initialPlot={listPlotPoints(workId)}
      initialTimeline={listTimeline(workId)}
      chapters={chapters}
    />
  );
}
