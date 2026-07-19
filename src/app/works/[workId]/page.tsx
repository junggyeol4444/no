import { redirect } from "next/navigation";

export default function WorkIndex({ params }: { params: { workId: string } }) {
  redirect(`/works/${params.workId}/chapters`);
}
