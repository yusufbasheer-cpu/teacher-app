# Gamma-only product UX

## Flow

`Lesson details → DeepSeek content → Design → Download`

After content generation, the results workspace presents Gamma design as the primary path for authorised testers. The legacy renderer is a small rollback action. DOCX/ZIP remain available for the already-generated teaching package.

The server fetches standard workspace themes from `GET /v1.0/themes` with `X-API-KEY`, follows cursor pagination defensively, caches results for six hours, and exposes only id/name/type/colour keywords/tone keywords. Three distinct intents are selected deterministically from returned keywords: Professional classroom, Modern educational, Visual and engaging. Swatches use Layah tokens; they are not claims about Gamma’s exact fonts or colours. The chosen ID is revalidated server-side before generation and stored in browser `localStorage` only as a convenience.

Truthful controls are limited to Gamma’s documented API: workspace theme, image source, AI image style, and the lesson language already chosen upstream. No exact image-count control is shown because Gamma does not provide one.

## Progress and recovery

The UI does not simulate granular backend events. While the export request is open it truthfully says Gamma is designing/exporting and Layah will validate afterward. If it times out, the existing ledger preserves the generation ID and the next identical request resumes rather than starting another paid generation.

A separate start/poll API was considered but intentionally not introduced: returning from a Vercel function cannot safely promise continued background polling without a durable queue/worker. The existing ledger already enforces one active run, resume-before-resubmit, unknown-outcome quarantine, rate limits, and budgets.

## Validation and motion

The returned file remains held until the verdict is visible. The panel shows clipped changed/missing examples, slide and image counts, credits, generation ID, and a resumed/no-new-charge badge. “Uncertain” means no text change was detected but formatting prevents a complete proof. “Failed” means missing, changed, or added text was detected; download requires an explicit override.

Motion is restricted to state indication: a small opacity pulse during the rare long-running generation, disabled under reduced-motion. Theme selection uses a 160 ms border/background/transform transition and native button/radio keyboard semantics.
