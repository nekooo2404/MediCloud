# MediCloud Local Design Skills (`.agents/skills/`)

These four external frontend/UI skills are installed **strictly locally** inside the MediCloud project directory under `T08-PORTAL-001` (`docs/decisions/t08-portal-skills-approval.md`):

| Skill | Source Repository | Cloned Commit SHA | Role in MediCloud |
|---|---|---|---|
| `ui-ux-pro-max` | `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` | `6ec2bb58334ca3014573c4cbd4834ee3a40afd9d` | Healthcare design intelligence, color/UX guidelines, local Python search engine (`scripts/search.py`) |
| `hallmark` | `https://github.com/nutlope/hallmark` | `04977e15f3dfd6ee4b74c887dac3eb52665d6c92` | 16-rule craft floor, Job-Driven page structure, anti-AI-slop verification |
| `impeccable` | `https://github.com/pbakaus/impeccable` | `b49177d32788f2dc585c42831d845dacf1ebed2c` | Operate/Read operational mode discipline, restraint, spacing rhythm, critique & visual audit |
| `taste-skill` | `https://github.com/leonxlnx/taste-skill` | `f6b76575f949707b4e3c37cd86cb44b0b98643e8` | House anti-slop rules, concise copy hierarchy, 3-viewport inspection discipline (`1440 / 768 / 390`) |

## Governance Precedence

When any guidance in `.agents/skills/` conflicts with MediCloud project rules, the higher-precedence source wins:

1. Direct decision approved by the project owner (`docs/decisions/t08-portal-skills-approval.md`)
2. `.medicloud/agent-company/CONSTITUTION.md`
3. Approved specifications and decision records (`docs/medicloud/`, `docs/decisions/`)
4. `AGENTS.md` (Astryx v0.7.17: no raw `<div>`/`<span>`, no Tailwind/utility classes, no raw `#hex`/`px`, no `:root` overrides, `astryx` theme editor + `astryx doctor`)
5. These 4 local design skills

### Excluded External Behaviors
- No global installation (`-g`, `~/.claude`, `~/.gemini`, or outside MediCloud root).
- No Hallmark random Theme Dealer (palette goes through the Astryx `medicloud` theme).
- No Tailwind classes or raw `<div>`/`<span>` wrappers.
- No `taste-skill` WebGL effects or external photo scraping (`assets.mjs` / `photos.mjs` are not executed).
