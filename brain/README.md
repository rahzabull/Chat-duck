# Ducky training round 2

Round two replaces the mild teacher voice with personality style cards, best-of-N humour judging, motif limits, and stronger unhinged/sarcastic sampling. Claude runs Ollama and GPU work. Codex made only local code/data changes: no network, MCP, installation, model inference, GPU training, or git commit.

The original `data/*.jsonl`, `runs/train/20261126T094823.966888Z/adapter`, and `export/ducky-4b-merged` remain untouched. Round-two data lives in `data/round2`, training in `runs/round2/train-v2`, export in `export/round2`, and evaluation in `runs/round2/eval-v1-v2`. Never import v2 over the `ducky:4b` tag.

## Current local status

- Created 4,600 contexts: the original recipe's 2,500 ambient + 1,200 conversation fixtures, plus **600 ambient and 300 distinct chat prompts**, split equally between unhinged and sarcastic.
- Reserved 230 held-out inputs before generation (67 unhinged, 75 sarcastic, 45 playful, 43 wholesome). Identical chat questions stay together; exact conversation-gold questions are train-only.
- Read all 98 ambient v2 anchors and all 20 conversation anchors. The isolated gold preview accepts **85 ambient + all 20 chat anchors**. The 13 ambient exclusions are four ungrounded-digit cases, three invented-observation cases, one ungrounded-time case, one identity-based roast, and four entries for unsupported app events (`reminder_due`, two `task_done`, `focus_done`). Gold is never silently rewritten to make it pass. The original app validator remains intact.
- `runs/round2/gold-preview/gold_inventory.jsonl` records every original and its status. This preview is **not a training dataset**; it lacks synthetic coverage and validation targets. Final motif exclusions can differ with the generated pool.
- Teacher generation, real humour scores, training, merging and v1/v2 evaluation remain for Claude. No humour improvement is claimed before that comparison.

## Repair the training environment first (Claude)

The converter downgrade installed Transformers **4.57.6**, Tokenizers **0.22.2**, Hub **0.36.2**, and NumPy **2.2.6**. Installed `datasets 5.2.0` requires Hub >=1.31.0 and fails while importing `Trainer` (`BucketNotFoundError` missing). Installed PEFT 0.22.0 imports but warns that Transformers <5.6 is deprecated. This environment has **uv, but no pip module**. Do not use `python -m pip`.

These are the exact proposed compatible training pins; Codex has not installed them or verified a full training step with them. Keep CUDA Torch 2.11.0+cu128. TRL is unused by this pipeline; removing it avoids carrying an unnecessary newer training stack. The scripts use plain Transformers Trainer and completion-only labels.

```powershell
Set-Location C:\Users\Enteio\Cloudiya\ducky-brain
$py = '.\.venv\Scripts\python.exe'

# Requires Claude's network access. Do not reinstall the converter requirements afterward.
uv pip uninstall --python $py trl
uv pip install --python $py --upgrade "transformers==4.57.6" "tokenizers==0.22.2" "huggingface-hub==0.36.2" "datasets==4.4.1" "peft==0.18.0" "accelerate==1.16.0"
uv pip check --python $py
& $py scripts\train_lora.py --check-deps --run-dir runs\round2\dependency-check
```

`requirements.txt` records the intended round-two pins, not a claim that the current environment already matches them. `--check-deps` is CPU-only and prints the repair command on import/API failure. Training/export use `torch_dtype`, local files only, and Hugging Face offline flags. The converter supports Q8_0 under the same Transformers 4.x pins; no environment switch is required.

## Exact round-two runbook

Run from this directory in PowerShell. The helper stops on native-command failure. The CPU-only steps can run before dependency repair, except the training dependency preflight. Keep one writer per journal. Run each stage to completion before the next stage.

```powershell
Set-Location C:\Users\Enteio\Cloudiya\ducky-brain
$py = '.\.venv\Scripts\python.exe'
function Run-Python {
    & $py @args
    if ($LASTEXITCODE -ne 0) { throw "Python stage failed: $args" }
}

# 1. CPU fixtures, using the existing local application interface snapshot.
Run-Python scripts\make_contexts.py --output-dir data\round2
Run-Python -m unittest discover -s tests -v
Run-Python scripts\generate.py --dry-run
# Optional isolated inspection, never used for training:
Run-Python scripts\filter.py --gold-only --output-dir runs\round2\gold-preview

# 2. Claude: local qwen3:14b, four candidates for unhinged/sarcastic, two for others.
# The smoke command fills slots in the real round-two journal; the next resumes it.
Run-Python scripts\generate.py --limit 12
Run-Python scripts\generate.py

# 3. Claude: score all valid candidates with qwen3:14b; cache after each context.
Run-Python scripts\judge.py
# Resume interruptions by repeating exactly that command.

# 4. CPU: consume only a complete judged artifact and produce train/val.
Run-Python scripts\filter.py
# Inspect the latest runs\round2\filter\<timestamp>\report.md, report.json,
# samples.jsonl, plus data\round2\gold_inventory.jsonl and dataset_manifest.json.

# 5. Claude: fresh BASE model, three epochs; retain this literal run directory for resume.
$trainRun = 'runs\round2\train-v2'
Run-Python scripts\train_lora.py --check-deps --run-dir runs\round2\dependency-check
Run-Python scripts\train_lora.py --run-dir $trainRun --epochs 3 --prepare-only
# Review tokenization.json and overlength.jsonl before loading the GPU.
Run-Python scripts\train_lora.py --run-dir $trainRun --epochs 3

# 6. Claude: merge the new adapter into the original base, in a new export directory.
Run-Python scripts\merge_export.py --adapter "$trainRun\adapter" --output export\round2\ducky-4b-v2-merged --model-tag ducky:4b-v2

# Match the local v1 Q8_0 export for the paired comparison.
Run-Python tools\llama.cpp\convert_hf_to_gguf.py export\round2\ducky-4b-v2-merged --outfile export\round2\ducky-4b-v2-q8_0.gguf --outtype q8_0
$modelfile = (Get-Content export\round2\Modelfile -Raw).Replace('FROM ./ducky-4b-v2-merged', 'FROM ./ducky-4b-v2-q8_0.gguf')
[System.IO.File]::WriteAllText((Join-Path (Get-Location) 'export\round2\Modelfile.gguf'), $modelfile, [System.Text.UTF8Encoding]::new($false))

# Preserve the existing v1 tag ONCE. If ducky:4b-v1 already exists, keep it.
# Inspect ollama list/show first; never point baseline and candidate at the same weights.
ollama show ducky:4b-v1
if ($LASTEXITCODE -ne 0) {
    ollama cp ducky:4b ducky:4b-v1
    if ($LASTEXITCODE -ne 0) { throw 'Failed to preserve v1 tag' }
}
Push-Location export\round2
try {
    ollama create ducky:4b-v2 -f Modelfile.gguf
    if ($LASTEXITCODE -ne 0) { throw 'Ollama import failed' }
} finally { Pop-Location }

# 7. Claude: full held-out + existing bake-off, both models under identical prompt modes.
$evalRun = 'runs\round2\eval-v1-v2'
Run-Python scripts\eval.py --candidate ducky:4b-v2 --baseline ducky:4b-v1 --humour --run-dir $evalRun
# Resume generation/judging by repeating the same command. Completed calls are cached.
# Rebuild the report without any model calls:
Run-Python scripts\eval.py --candidate ducky:4b-v2 --baseline ducky:4b-v1 --humour --run-dir $evalRun --report-only
```

The default paths of generation, judging, filtering, training and evaluation now point at round two. `make_contexts.py` reuses the original contract snapshot; `--refresh-contract` explicitly re-extracts local app interfaces if needed. The application repository is never modified. Do not change the contract or code mid-journal: manifests reject changed generation/judging/training inputs. For a revised recipe, use a new directory and explicit `--contexts`, `--contract`, `--raw`/`--output`, `--judged`, `--cache`, `--train`, `--val`, `--heldout`, and `--bakeoff` paths as applicable.

All actual network-capable inference code uses the fixed `127.0.0.1` Ollama origin, disables proxies, rejects redirects and remote/cloud tags, and never pulls models. Codex's tests mock those calls. Only Claude's explicitly listed dependency installation needs external network access.

## Voice, judging and filtering

`voice.py` contains the four style cards and 30 absurd topic seeds. Unhinged is dramatic, oddly specific, conspiratorial and lightly villainous; sarcastic is dry and judgy; playful has goofy game-show energy; wholesome stays warm, weird and funny. Gentle roasts target choices/situations, never appearance or identity. Emotional responses remain kind. Casual banter prioritizes a punchline; explicit factual/tool requests still require useful, correct behavior.

Teacher answers and few-shots come only from local `qwen3:14b`, the two supplied gold files, and the `LINES`/`TALK_LINES` content from `lines.ts`. The original snapshot's presets/guides remain interface/evaluation metadata; round-two generation does not use their authored responses or the old helpfulness-first teacher guide. At least six of eight unhinged ambient few-shots are v2 anchors, with same-event anchors preferred. Chat few-shots use v2 conversation anchors for unhinged. Slots are filled from synthetic context. Topic seeds are generation guidance, not invented observations or new runtime context fields.

Generation makes independent requests: **4** for unhinged/sarcastic and **2** for playful/wholesome. Temperature is **1.0** for unhinged, **0.9** otherwise. Default concurrency is two. `--candidates N` is an explicit experimental override and must match between generation and judging; normal runs should omit it. The deterministic fixture set requires 14,680 candidate requests. Use a new journal if changing seeds, source gold, prompts, schema or model.

`judge.py` first applies strict validation and the ambient assistant-phrase filter. Every context with valid candidates is scored, including singletons (no quality bypass). All candidates for a context share a judging call, using temperature zero, seed 42, a short 1?10 rubric and three calibrations: v2 legal absurdity **9**, a bland actual v1 `lines.ts` observation **3**, and a generic help offer **1**. The highest score wins; ties use candidate index. A winner below **6** drops the context. No lower-ranked fallback is substituted if later deduplication rejects the winner.

Scores are journaled to `data/round2/judge-cache.jsonl`; cache keys include candidate content, context, code, gold, rubric, contract and judge model. Malformed/partial scores and transport failures are not cached as successes. Reruns retry failures. `judged.jsonl` and its completion marker are published only after all judging succeeds. `--allow-partial` is inspection-only; the production filter refuses its missing-context completion marker.

For ambient events other than `assist_offer_*`, the phrase penalty is a hard rejection: `need help`, `I can help`, `let me know`, `happy to help`, `just checking`, `would you like me to`, plus common paraphrases. Real requested chat assistance remains allowed. Strict schema, tool permissions, numeric grounding and app language checks remain enforced. Gold exclusions are reported rather than bypassing those checks.

Accepted gold stays in train. Every accepted v2 ambient/chat example has **five physical replicas**; eligible legacy `lines.ts` gold has three. Synthetic rows are deduplicated at word Jaccard >=0.6 against all eligible gold and both splits. Gold duplicates remain train-only. Silence is not a humour training target.

Bread (including crumbs/toast), pigeon and hat each occupy at most **4% of visible beats per personality and split**, checked both uniquely and with gold weighting. Motif-free rows are admitted first, then themed rows in gold/score priority. Training reaches the **35% unhinged / 30% sarcastic / 20% playful / 15% wholesome** target, to rounding tolerance, by adding deterministic replicas of motif-free synthetic examples. Gold remains exactly 5x or 3x; no extra gold replicas are used for balancing. This raises exposure to the desired personalities without fabricating answers or weakening motif caps. If a personality has no eligible synthetic rows for balancing, filtering fails with a deficit report. Validation is neither replicated nor balanced. Reported unique counts distinguish actual diversity from training exposure.

## Training and evaluation details

Training rejects adapters or merged models passed as `--base`; it loads `models/Qwen3-4B-Instruct-2507`. Defaults: **3 epochs**, bf16, SDPA, LoRA rank **16**, alpha **32**, dropout **0.05**, q/k/v/o and gate/up/down projections, learning rate **2e-4**, microbatch **2**, effective batch **32**, maximum sequence length **768**, cosine schedule and 3% warmup. It retains assistant-only completion loss, gradient checkpointing, no packing, and best-validation-loss checkpoint selection. Overlong examples are logged and dropped; empty train/validation is fatal. Existing round-one run manifests are incompatible and cannot be resumed into a round-two adapter.

With `--humour`, evaluation runs v1/short, v2/short, v1/app and v2/app on exactly the same inputs, using matched seeds and temperatures. `--skip-native-arm --humour` runs only the two short-prompt arms. Warm-ups are excluded. Judge scoring runs after model generation to avoid repeatedly swapping the teacher and candidate models on the GPU. Evaluation never supplies v2 gold few-shots to either short-prompt model; the app arms retain the original app prompt behavior for compatibility comparison.

`report.md` includes existing format/safety/latency metrics, **mean humour score per personality and model/mode on the full held-out set**, and **30 random unhinged held-out contexts side by side for every arm**, using one fixed sample selection. Invalid/silent/transport outputs score 1 and remain visible. Missing judge calls show a pending mean rather than silently reducing the denominator. Bake-off rows do not enter humour averages or the 30 samples. `humour-summary.json`, `humour.jsonl` and `humour-cache.jsonl` preserve numeric results and resumability. Automated humour ratings are a screening aid; Rahul's paired review is still the decision about whether the new personality works.

Offline tests cover the existing app-validator parity, tokenizer masks, tool contracts, crash journals and generation/eval resume, plus round-two context counts, style selection, phrase exceptions, candidate provenance/completeness, judge score validation/caching/thresholds, motif caps, exact gold weighting, personality balance, and paired humour report/resume. They do not load full model weights, run Ollama, install packages or claim GPU training compatibility before the documented repair.
