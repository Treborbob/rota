// Claude Code PostToolUse hook (see .claude/settings.json): after every
// Edit/Write, run Biome on the touched file so formatting churn never reaches
// a diff. Fail-soft: a formatting problem must never block the edit itself;
// `pnpm check` remains the authoritative gate.
import { execSync } from "node:child_process";

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) {
  input += chunk;
}

try {
  const payload = JSON.parse(input);
  const filePath = payload?.tool_input?.file_path;
  const formattable = /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc|css)$/i;
  const generated = /(^|\/)(lib\/generated|node_modules|\.next)\//;
  if (filePath && formattable.test(filePath) && !generated.test(filePath)) {
    execSync(`pnpm exec biome check --write "${filePath}"`, {
      stdio: "ignore",
      timeout: 20_000,
    });
  }
} catch {
  // Swallow everything: unparseable payload, biome diagnostics, timeouts.
}
process.exit(0);
