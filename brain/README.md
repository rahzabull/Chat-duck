# Ducky's own brain

An offline dataset → local teacher → validation → LoRA → Ollama pipeline for the existing Ducky application. Run from `C:\Users\Enteio\Cloudiya\ducky-brain` with `.venv\Scripts\python.exe`. No installation, hosted inference, telemetry, downloads, or changes to `ducky-exe` are required. Node 24 is used only to read TypeScript constants and test the original validators. Nothing is committed.

The scripts are implemented and CPU checks have been run. **Teacher generation, GPU training, merging weights, Ollama import, and model evaluation have not been run by Codex.** Timings below are planning estimates, not measured performance or evidence of model quality.

## Runbook

Use PowerShell. Finish the base-model and local teacher downloads before the relevant steps. Keep other large GPU workloads unloaded while generating or training.

```powershell
Set-Location C:\Users\Enteio\Cloudiya\ducky-brain
$py = '.\.venv\Scripts\python.exe'

# 1. Deterministic, CPU-only. Already generated; safe to rerun against unchanged app sources.
& $py scripts\make_contexts.py

# Optional offline verification: no HTTP requests or model weight loads.
& $py -m unittest discover -s tests -v
& $py scripts\generate.py --dry-run
& $py scripts\merge_export.py --prepare-only

# 2. Local teacher. A smoke run fills the first 12 candidate slots in the real journal.
& $py scripts\generate.py --limit 12
# Continue the same journal; skips completed context/candidate pairs.
& $py scripts\generate.py
# Alternative teacher: use a SEPARATE journal, never change a journal's model in place.
# & $py scripts\generate.py --model qwen3:8b --output data\raw-8b.jsonl

# 3. Validate, rank and deduplicate. Requires all 3 candidates per context by default.
& $py scripts\filter.py
# Read runs\filter\<timestamp>\report.md, report.json and samples.jsonl before training.
# Partial preview, isolated from production training data:
# & $py scripts\filter.py --allow-partial --output-dir runs\partial-preview\data

# 4. Pick a persistent run directory ONCE. Reuse the literal path after interruptions.
$trainRun = 'runs\train\' + (Get-Date -Format 'yyyyMMddTHHmmss')
& $py scripts\train_lora.py --run-dir $trainRun --prepare-only
# Inspect tokenization.json and overlength.jsonl. No silent truncation of JSON targets.
& $py scripts\train_lora.py --run-dir $trainRun
# Resume: same command, same run directory, same dataset and hyperparameters.

# 5. Merge on CPU (roughly 20–30 GB free host RAM); --device cuda is also supported.
& $py scripts\merge_export.py --adapter "$trainRun\adapter"
Push-Location export
ollama create ducky:4b -q q4_K_M -f Modelfile
Pop-Location

# 6. All held-out inputs + two rounds of the original 14 app bake-off cases.
$evalRun = 'runs\eval\' + (Get-Date -Format 'yyyyMMddTHHmmss')
& $py scripts\eval.py --run-dir $evalRun
# Resume by reusing that path. Failed requests remain recorded as failures.
# To retry failures as a fresh benchmark, choose a NEW run directory.
# To rebuild just the report:
& $py scripts\eval.py --run-dir $evalRun --report-only
```

Every main script supports `--help` and writes a log under `runs/<step>/`. Check `$LASTEXITCODE` after commands: PowerShell does not automatically stop this sequence when a native command fails. Do not train a partial/empty dataset.

| Step | Planning allowance | What changes it |
|---|---|---|
| Contexts and contract snapshot | Seconds | Local source reads only |
| 11,100 teacher requests | Several hours; budget roughly 3–15 hours initially | Teacher quantization, prompt prefill, context cache, response lengths, concurrent scheduling |
| Filter | Seconds to a few minutes | Exact global Jaccard checks and accepted dataset size |
| CPU tokenization | Under a few minutes | Number and length of accepted rows |
| Two LoRA epochs on the 5090 | Budget 30–120 minutes initially | Accepted rows, supervised token count, GPU load, microbatch |
| CPU merge and Ollama quantization | Several minutes to tens of minutes | RAM, disk and CPU throughput |
| Eval, 3 arms × 213 inputs | Budget 20–90 minutes initially | Response lengths and local generation speed |

Use `latency_ms` in the first generated journal entries to replace these estimates: approximately `remaining requests × mean seconds / observed concurrency`. Ollama may serialize the two client workers, so do not assume a 2× speedup. Training logs include runtime and loss; evaluation excludes explicit warm-up calls and includes failed-request latency.

## Contracts and source provenance

`data/app_contract.json` contains source hashes and a read-only extraction of the app's 64 situations, 507 authored ambient/preset/conversation lines, policies, personality styles, enum values, ambient JSON schema, voice guide, tool descriptions and original 14 bake-off contexts. No application state, real window titles, user storage, or personal files are read. Node evaluates selected constant initializers in a restricted VM; it never imports Electron or starts the application. If extraction fails after an app source change, fix the extractor rather than silently keeping a stale contract.

`data/contexts.jsonl` contains **2,500 ambient** and **1,200 conversation** fixtures. Ambient `context` has exactly the app's `AIContext` field names: `event`, `localTime`, and optional personality, profanity, mood, emotions, name, memoryFact, app, safeTitle, screenDescription, count, minutes, hours, overdue, remaining and reminder. There is no `appCategory` in the app's interface; categories are represented by events and invented app/title pairs. All 64 × 4 × 2 event/personality/profanity-setting combinations occur. Wholesome/playful settings may have the flag on, but their dataset targets still cannot swear.

Names are the literal `{name}` placeholder or absent. Gold replaces that slot with `friend`, because the ambient validator forbids braces in output. Titles such as `Figma – Landing page` and `YouTube – lofi beats`, memories, dates, IDs and conversations are synthetic. Generated outputs are checked for common personal names, unfamiliar capitalized tokens, emails, phone-like strings and credentials, including tool arguments. This deliberately conservative name heuristic can reject legitimate prose; exclusions are visible in reports. Inspect samples before training: automatic filters do not establish factual correctness or exhaustively detect every possible identifying string.

Conversation uses the actual `EngineContext` data concepts, serialized into a compact projection: `settings` (personality, profanity, skillPack, memoryEnabled, preferredName), `turns` (role/text/at), `memories`, `summaries`, `now`, plus `localDateTime`, `availableTools` and optional `toolResult`. The extra fields represent information the current app places in its system prompt or tool-result message. Conversation output is exactly `{reply,tone,tool}`; ambient output is exactly `{shouldSpeak,dialogue,then,emotion,animation}`. A Ducky tool call is a JSON `tool` object, **not** Ollama's native `tool_calls` format. All 29 registry names are exposed in ordinary fixtures, matching the app's available tools; argument checks cover remember, forget, recall_memories, recall_conversations, add_task and add_reminder. Targets invoking unaudited tools are rejected. This job does not train operations for all 29 application tools.

Conversation fixtures cover casual chat, jokes, what Ducky is doing, his personality, short knowledge explanations, brainstorming, writing, code, everyday advice, refusals, capabilities, missing details, explicit memory permissions, task/reminder requests and successful tool results. They include “can you remind me to drink water in every half an hour”, with a checked 30-minute interval. The app's minimum supported interval is five minutes. Dates are resolved against each fixture's fixed local date/time, not the machine clock when a script runs.

The teacher uses only `qwen3:14b` or `qwen3:8b` on `127.0.0.1`, `/api/chat`, `think:false`, the app's response schema, temperature 0.9, three independently seeded candidates and two workers. Long prompts include the full voice guide, personality style and up to ten eligible authored examples for that situation. Some situations contain fewer than six distinct authored lines; their smaller pools are preserved rather than padded with invented gold. No generated output from a hosted API is used. All network-capable code uses a fixed loopback origin, disables proxies and rejects redirects. Training/export force Hugging Face offline mode and `local_files_only=True`.

## Filtering, split and gold policy

The Python validator ports the ambient app checks: exact shape, quote cleanup, lengths, banned openers, observation privacy, invented-observation vocabulary, numeric and **whole-clock-time** grounding, content blocklist (including obfuscation), profanity, emoji/markdown/URL rejection, recent similarity and app enum fallback behavior. Conversation retains its separate contract: code and markdown are allowed, arbitrary knowledge answers are not constrained to ambient digits or observation words, and replies need at least three words and at most 4,000 characters.

Dataset checks are intentionally stricter: enums must be valid; silence must have empty text; no emoji before app cleanup; profanity obeys personality and setting in both modes; proposed tool arguments must pass the audited argument checks; explicit task/interval cases must request the expected operation; unverified action acknowledgements are rejected. The app's ordinary conversation validator alone does not enforce all these conditions, so eval reports both app-validator and dataset-rule rates.

The 95/5 split is reserved **before generation**: 3,515 synthetic train inputs and 185 held-out inputs. Ambient allocation is stratified by situation/personality with largest-remainder rounding; it is impossible to put a validation row in every tiny stratum while keeping 5%. Identical conversation questions stay together across personalities, settings and dates, with category/personality balancing. Validation targets that fail filtering are dropped, but **all 185 held-out inputs remain in eval**, preventing an artificially easy benchmark. The final accepted train/val ratio can differ from 95/5 because of rejection and gold weighting.

All 507 authored lines are inventoried in `gold_inventory.jsonl`. Only eligible, validator-passing gold becomes training data; no unsafe or invalid line is forced into the model just to achieve an “all lines” count. The inventory records every exclusion and original template. Gold stays in train so validation measures unseen generated targets, and each accepted gold example appears exactly three times. `weight: 3` is metadata; the three physical rows implement the weight without depending on Trainer support. The gold-only smoke output is under `runs/smoke/`, not the production dataset.

Generated candidates are ranked by generic-phrase penalty, frequency and lexical variety. One is selected per context or the context is dropped. Word Jaccard ≥ 0.6 is checked against **every accepted beat/reply across both splits and all accepted gold**, using an exact inverted index. The 30 most common candidate lines are additionally tracked; one representative may survive, repeated near-paraphrases cannot. Authored gold repetitions are retained intentionally, all on the same side of the split. Silent targets are capped at 2% of input contexts to prevent silence collapse.

Reports include per-situation/personality/source/split counts, candidate and context rejection reasons, gold exclusions, common lines, per-personality samples and a full accepted-example sample file. Review language, tool correctness and coverage before training. A loss decrease alone does not establish that Ducky sounds better.

## Training and export

`train_lora.py` uses the installed Transformers Trainer and PEFT directly, avoiding version-sensitive TRL chat-mask assumptions. Defaults: bf16, SDPA, r=16, alpha=32, dropout=.05, q/k/v/o/gate/up/down projections, learning rate 2e-4, cosine schedule, 3% warm-up, two epochs, max sequence length 768, no packing, microbatch 2 × accumulation 16 = effective batch 32, gradient checkpointing. No bitsandbytes, flash-attn or external reporting. Windows dataloader workers are zero.

The tokenizer renders the real HF chat template. The system/user/prompt prefix is labelled `-100`; only assistant JSON plus its closing token/newline contributes loss. Prefix alignment is asserted at the token level. Padding is also masked. Oversized records are **dropped whole**, logged in `overlength.jsonl`; truncating a JSON target would train invalid output. If many useful coding/tool examples exceed 768, inspect the report before explicitly choosing a larger `--max-length` and a new run. Empty train or validation sets stop training.

Validation and full resumable checkpoints occur approximately every half epoch (rounded to optimizer steps); the best validation-loss adapter is loaded before final save. Logs go to `metrics.jsonl`, the adapter to `runs/train/<timestamp>/adapter`, and a `COMPLETE.json` marker identifies a finished run. Reusing a run resumes the latest checkpoint containing trainer state, adapter, optimizer and scheduler; changed inputs/hyperparameters fail closed. For an OOM, choose `--batch-size 1` with effective batch 32 in a **new** run; it changes optimizer scheduling and cannot silently resume the old run.

`merge_export.py` merges into bf16 safetensors in a staging directory, verifies shard presence, and publishes `export/ducky-4b-merged` only after completion. A matching completed export is a no-op; conflicting output is never overwritten. Interrupted staging can be recomputed with identical inputs. The adapter is kept intact.

`export/Modelfile` uses `FROM ./ducky-4b-merged`, a short default SYSTEM, non-thinking Qwen3-Instruct ChatML delimiters, appropriate stop tokens and local inference parameters. Four fixtures check the installed HF template against the exact message serialization represented by the Go template. This covers text system/user/assistant messages and Ducky's JSON tools, not HF native XML tool-call serialization. Ollama import/quantization must still be verified by running:

```text
ollama create ducky:4b -q q4_K_M -f Modelfile
```

## Evaluation and application integration

Default eval runs three arms on identical inputs:

1. `ducky:4b/short`: the exact compact JSON training protocol.
2. `ducky:4b/app`: the existing long ambient/conversation prompt structure, testing a model-name-only swap.
3. `qwen3:8b/app`: the current long-prompt baseline.

Both models receive the same output schemas, temperature settings, token limits and seeded requests. Each arm has its own recent dialogue history for validation and baseline few-shot prompting. The original bake-off cases run twice in their original order, with recent dialogue reset at the start of that suite. No teacher completion is used as a gold answer in eval. Review `report.md` and `results.jsonl`: JSON validity, app validation, stricter dataset checks, speech rate, average/p95 latency, exact distinct-line rate, generic-phrase rate, 20 randomly selected accepted replies per personality when available, rejected examples and paired outputs. A silent response counts as structurally valid but not as spoken; a benchmark must not reward silence as if it were good dialogue.

**Changing only `aiModel` does not switch the app to the short training prompt.** Judge that deployment using `ducky:4b/app`. To use the short arm in production, the app needs an explicit prompt adapter: send the short per-personality system message and compact JSON context, including its approved memories/turns/tools/tool results for conversation. Preserve existing privacy, tool confirmation and output validation in application code. This repository leaves `ducky-exe` untouched; it does not claim that an unevaluated model-name swap is equivalent to the short-prompt benchmark.

Metrics do not measure factual accuracy, code execution correctness, human voice preference, or safe handling of every possible input. Compare the paired samples and tool objects, and keep the baseline unless the native or explicitly adapted deployment actually wins. Actual HTTP timeout behavior in the desktop app is stricter than this offline evaluation's default 180-second timeout; inspect latency before deployment.

## Resume and reproducibility

- Context generation and filtering atomically rewrite deterministic outputs. Use a new data/raw path when changing source snapshots or generation parameters.
- Generation journals are append-only, flushed after each candidate, recover only a torn final JSONL line, and reject corrupt interior lines. Failures go to the run's errors file and are retried on the next invocation. The journal manifest prevents mixing changed contexts, contract, model or generator code. Run one writer per journal.
- Training and evaluation resume only when given the same `--run-dir`. Completed training is a no-op. Evaluation retains transport failures; create a fresh run to remeasure them.
- Keep model tags unchanged during a generation/eval run. Seeds make fixtures and splits deterministic; GPU/model inference is not promised to be bit-for-bit reproducible.
- `requirements.txt` records the already-installed packages used here. It is not an instruction to install anything; Claude may regenerate the full freeze locally.

The seven offline tests check schema coverage and split grouping, journal crash recovery, exact Jaccard behavior, tool argument validation, real-tokenizer loss masks and padding, generation/evaluation resume with mocked local responses, and differential agreement with the original JavaScript validators on hundreds of cases. They do not load full model weights or access the network.
