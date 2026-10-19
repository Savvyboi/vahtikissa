# Programme themes and AI briefs

The site stays static. OpenRouter is called only by the offline importer or GitHub Actions; reading pages never sends visitors' data to an AI provider. The API key is read from the environment and never saved in public JSON, browser code or local storage.

## Enable generation

1. Add an OpenRouter key as the repository Actions secret **OPENROUTER_API_KEY**.
2. Optionally set repository variables **OPENROUTER_MODEL** and **AI_MAX_REQUESTS**. Defaults are google/gemma-4-31b-it:free and 40 requests per run.
3. Run **Daily AI briefs and programme tags** from Actions. It also runs daily at 05:19 UTC, after the existing data refresh schedules.
4. Allow the cached backfill to continue over successive runs. Programme analysis completes first; votes and proposals are then processed in alternating order, newest first. With about 10,000 records and free-provider quotas, a complete backfill takes many runs. The UI distinguishes unavailable briefs from completed analysis.

For local generation in PowerShell, set the environment without putting a real key in source files:

    $env:OPENROUTER_API_KEY = '<your OpenRouter key>'
    npm run sync:ai

Node reads the environment directly; no dotenv dependency or public settings screen is used. No key is included with this change. Without one, the importer reports a skip and preserves existing results.

Only models ending in :free are accepted. There is no paid fallback. OpenRouter documents 20 requests per minute and daily free-model allowances depending on account credits (50 or 1,000); the default run budget leaves room within the lower allowance but cannot account for other applications sharing the key. Temporary HTTP/provider 408, 500, 502, 503 and 504 errors get up to two retries with backoff; every attempt counts against the run budget. Authentication errors, quota limits, exhausted server-error retries and truncated output stop generation without destroying completed results. Reaching the configured request budget is a normal pending backfill result. Direct-generation models get up to three attempts to correct malformed JSON or rejected evidence, translations and tags; every attempt counts against the same request budget. Validation remains strict after retries. A provider request may take up to five minutes before it times out; programme/chunk progress is logged without credentials, prompts or model response bodies. Successful records checkpoint individually and later runs resume. Model availability and free-tier terms can change.

Sources: [Gemma 4 31B free endpoint](https://openrouter.ai/google/gemma-4-31b-it:free), [OpenRouter limits](https://openrouter.ai/docs/api/reference/limits). The endpoint's provider terms apply; only already-public parliamentary and programme data is sent.

## Method and limits

The importer fetches each original Pohtiva programme body, excluding page navigation. Long documents are analysed in chunks of at most 6,000 characters, requesting at most four themes per chunk, and only complete programme analyses are published. The host divides each chunk into numbered verbatim source passages. The model selects a passage ID for each theme; the host inserts the original passage rather than asking the model to copy it. Unknown passage IDs are rejected. Each theme includes FI/SV/EN labels and an exact quote validated against the original source text. An explicit commitment is marked as a promise; other passages are marked as themes. Shared stable IDs connect the same policy themes across parties without treating opposing positions as equivalent.

Proposal/vote classification can use only IDs extracted from the programmes. Theme links indicate subject relevance, **not** support, opposition, promise fulfilment or a political score. Visitors can inspect source quotes, filter proposals/votes by a theme, and follow themes in this browser. The **Followed themes** filter is a saved local view for checking updates; there are no email notifications, accounts or background alerts. Tag filters use shareable ?tag=... hash-route parameters and work with the existing search, topic and status filters.

Briefs are 2–4 sentences in Finnish, Swedish and English. The offline importer now fetches original parliamentary documents through the official document API, requiring an exact document identifier and Finnish language match. For government proposals it extracts the “Esityksen pääasiallinen sisältö” section; other documents use a bounded opening excerpt. Votes on a committee report also include its excerpt when the matter explicitly links that report and its published version predates the vote. Briefs explain concrete proposed measures and affected groups, then distinguish the exact vote alternatives from the underlying proposal. The model selects numbered evidence passages, and the host stores the verbatim evidence and original document links. Missing counterproposal content and legal effects must not be inferred. If the original text is unavailable, the brief remains explicitly labelled as metadata-only. These are summaries of document excerpts, not the complete legislative history or final law.

The AI brief panel starts collapsed with a visible mistakes notice. Opening it loads only that record's cached file; language tabs support arrows, Home and End. The panel sits after the vote result or matter summary. Its compact body leads with the brief; original sources, evidence and method details remain accessible in a secondary disclosure. Text is rendered as text/escaped HTML, never as model-generated markup. Failed requests can be retried. Browser storage failures do not prevent reading.

**data/ai-insights.json** holds the programme evidence and a compact tag/file index. Content-addressed brief files live in **data/ai/**. Record signatures invalidate tags and briefs when source metadata changes; old briefs are also checked against the complete source record when opened. Generated timestamps alone do not invalidate unchanged records. Changes to the model, prompt version or theme vocabulary queue regeneration. Existing content files are immutable; unreferenced historical files can be removed in a future storage-maintenance pass.

Run **npm run sync:ai -- --refresh-programmes** to re-fetch programme bodies and reanalyse changed texts. The daily schedule rechecks source bodies and reanalyses only changed documents. Local runs use cached analyses for unchanged programme metadata unless this flag is supplied. Update **PROMPT_VERSION** for programme analysis changes and **RECORD_PROMPT_VERSION** for brief-generation changes; upgrading record prompts preserves unchanged programme analyses. Programme source URLs, collection years and party identities come from the existing verified programme snapshot.

Run **npm run check** for syntax, unit and source-data checks, and **npm run test:ai-browser** for mocked end-to-end UI checks. Tests never need a live key and do not call OpenRouter.

## Choosing Gemma, Inkling Small or Nemotron

The deployed repository currently selects **nvidia/nemotron-3.5-super-vl:free** through OPENROUTER_MODEL. It uses NVIDIA sampling settings (temperature 1, top_p 0.95), reasoning disabled and bounded structured JSON output. See the [OpenRouter endpoint](https://openrouter.ai/nvidia/nemotron-3.5-super-vl:free) and [NVIDIA model card](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Super-VL-120B-A12B-BF16). The code default below applies only when the repository variable is absent.

The default is **google/gemma-4-31b-it:free**, using the direct-generation path. To choose Inkling instead, set OPENROUTER_MODEL to **thinkingmachines/inkling-small:free**. A repository variable named **OPENROUTER_MODEL** overrides the code and workflow defaults, so any existing variable must match your chosen model.

Inkling's [OpenRouter model page](https://openrouter.ai/thinkingmachines/inkling-small:free) says its free endpoint is restricted to agentic harnesses, supports tool calls, and does not support response_format. The importer therefore runs a bounded tool loop for Thinking Machines free models: the model reads the supplied source through read_source and submits its result through submit_analysis. The host validates source evidence, translations and tags, returning failed submissions for correction. Each analysis normally takes two API requests, with at most six turns. All turns count against AI_MAX_REQUESTS, so 40 requests will normally produce at most 20 completed analyses, fewer if retries are needed. Results are cached as before. This is a custom source-analysis harness; it does not impersonate another agent client.

This endpoint logs prompts and outputs for model improvement and prohibits confidential or personal data. Review the linked provider terms before use. The importer sends political source documents and proposal/vote metadata, never site visitors' information or individual MPs' ballot histories.

To use the original direct-generation path instead, set OPENROUTER_MODEL to **nvidia/nemotron-3-super-120b-a12b:free**. Switching models queues regeneration automatically; the same API secret is used.

For language quality, NVIDIA's [base model card](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-Base-BF16) lists Finnish and Swedish, while its [instruction/chat model card](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16) lists only English, French, German, Italian, Japanese, Spanish and Chinese as supported languages. General multilingual benchmarks do not establish Finnish or Swedish parliamentary-summary accuracy. Review sample outputs in both languages before a large backfill.

## GitHub walkthrough

Before starting a batch, run [Diagnose OpenRouter access](https://github.com/Savvyboi/vahtikissa/actions/workflows/diagnose-openrouter.yml). It checks authentication and a tiny completion using the selected repository model. A successful key check followed by a provider error does not mean the key is invalid. The diagnostic never logs the key or provider response bodies.

1. Commit and push the local feature changes to main. The workflow must exist on GitHub's default branch before its manual Run workflow button appears.
2. Open [Actions variables](https://github.com/Savvyboi/vahtikissa/settings/variables/actions), choose New repository variable (or edit the existing one), set Name to OPENROUTER_MODEL and Value to your selected exact model ID above. This is a variable, not another secret. Keep OPENROUTER_API_KEY as the existing repository secret.
3. Open [Daily AI briefs and programme tags](https://github.com/Savvyboi/vahtikissa/actions/workflows/daily-ai-sync.yml), select Run workflow and branch main. Leave max_requests at 40 for the initial run and refresh_programmes unchecked. Initial missing programme analyses are fetched automatically.
4. Open the run, then the Generate cached AI insights step. Programme evidence is generated first; a request-budget stop with pending work is expected. Rerun on later days to resume. HTTP 401 usually means authentication failed; 429 means a provider/platform rate limit; validation failures retain already completed results.
5. Check the automatic data commit and the Deploy to GitHub Pages run. A proposal/vote gets language tabs once its brief has been generated. Until then it explicitly says no AI brief is available. Briefs use bounded original document excerpts when available and explicitly labelled metadata otherwise.

References: [GitHub repository variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables), [manually running workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

### Review provenance

The initial 25 brief files were editorially reviewed against their published source metadata. Reviewed files carry `reviewedAt` and `reviewMethod` separately from the original generation timestamp and model. Corrections create new content-addressed files; the index points to the corrected versions. This review checks the stated voting alternatives, recorded counts, processing stages, translations and direct theme relevance without inferring missing legal effects. It does not imply that later automatically generated briefs have received the same review. The AI accuracy notice and metadata-only limitation remain applicable.

Original document excerpts are cached in **data/ai-sources/** with source hashes, timestamps and canonical links. A newer source-record timestamp or a cache older than a day requires a fresh fetch when that record is queued. The workflow publishes the source cache alongside completed briefs. Run **npm run test:vote-reading** for compact one-page vote rosters, party links, brief placement and unified collection controls.

The first 35 version-5 briefs were editorially reviewed against the cached original excerpts and recorded vote metadata. Corrections narrow benefit scope, retain proposal/committee distinctions, remove unsupported status claims and unrelated theme tags, and keep each language within 100 words. Separate review timestamps and methods preserve the original generation provenance. Later automatic briefs are not implied to have received this review.

The host rejects briefs longer than 100 words per language or containing internal JSON fields and language-summary headings, allowing the existing bounded correction loop to retry. Changes to shared validation and workflow configuration do not automatically spend generation requests; push-triggered batches are limited to importer/source-extraction changes. Scheduled and manually requested backfills remain available.
