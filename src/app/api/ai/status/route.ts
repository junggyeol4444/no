import {
  assertProviderReady,
  getActiveAiInfo,
  getInstalledOllamaModels,
} from "@/lib/ai";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

// 현재 공급자 연결 상태 점검 (설정 UI의 "연결 확인")
export async function GET() {
  const info = getActiveAiInfo();
  const models =
    info.provider === "ollama" ? await getInstalledOllamaModels() : [];
  try {
    await assertProviderReady();
    return json({ ...info, ok: true, message: "정상", models });
  } catch (err) {
    return json({
      ...info,
      ok: false,
      message: err instanceof Error ? err.message : "사용 불가",
      models,
    });
  }
}
