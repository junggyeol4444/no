import { json, serverError } from "@/lib/http";
import { getAiSettings, saveAiSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";

function withKeyFlag() {
  return {
    ...getAiSettings(),
    anthropicKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY),
  };
}

export function GET() {
  return json(withKeyFlag());
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    saveAiSettings(body);
    return json(withKeyFlag());
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "설정 저장 실패");
  }
}
