import CharacterManager from "@/components/CharacterManager";
import { parseId } from "@/lib/http";
import { listCharacters } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function CharactersPage({
  params,
}: {
  params: { workId: string };
}) {
  const workId = parseId(params.workId)!;
  const characters = listCharacters(workId);
  return <CharacterManager workId={workId} initial={characters} />;
}
