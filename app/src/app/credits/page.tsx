import type { Metadata } from "next";
import { Doc } from "@/components/Doc";

export const metadata: Metadata = { title: "Credits" };

export default function Page() {
  return (
    <Doc kicker="Made by" title="Credits">
      <p>Made by <b>Hanif</b>, with AI help from Claude (Anthropic) for code, research and asset editing.</p>
      <h2>Bambu Runcing</h2>
      <ul>
        <li><b>Images:</b> generated with Nano Banana (Google) via fal.ai, then cut out and edited by hand. Cover art: GPT Image 2.5 (OpenAI) via fal.ai.</li>
        <li><b>Sound:</b> effects and narration by ElevenLabs; music by Stable Audio 3 (Stability AI), via fal.ai.</li>
        <li><b>Engine:</b> Phaser 3 (MIT licence).</li>
        <li><b>Type:</b> Press Start 2P by CodeMan38 (SIL Open Font License 1.1).</li>
        <li><b>History:</b> the full list of historical sources is in the game under <i>About &amp; Sources</i>. Real events, fictional battles.</li>
      </ul>
      <h2>This site</h2>
      <ul>
        <li>Next.js and React (MIT). Better Auth (MIT). SQLite.</li>
        <li>Fonts: Manrope, JetBrains Mono, Unbounded, Cinzel, Black Ops One, Press Start 2P — all SIL Open Font License.</li>
      </ul>
    </Doc>
  );
}
