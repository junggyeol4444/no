import AiSettingsPanel from "@/components/AiSettingsPanel";
import { getAiSettings } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function GlobalSettingsPage() {
  const s = getAiSettings();
  return (
    <AiSettingsPanel
      initial={{
        ...s,
        anthropicKeyPresent: Boolean(process.env.ANTHROPIC_API_KEY),
      }}
    />
  );
}
