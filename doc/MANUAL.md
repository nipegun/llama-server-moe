# User manual

[English](MANUAL.md) · [Español de Argentina](MANUAL.es-AR.md) · [Español de España](MANUAL.es-ES.md)

Contents: [installation](#installation), [local build](#local-build), [deployment](#deployment),
[chat](#chat), [models and tools](#models), [API](#api),
[performance](#performance), [removed compatibility](#removed-compatibility),
[maintenance](#maintenance).

<a id="installation"></a>
## Installation and first launch

Install as root on the production host. Debian/Ubuntu accepts the installer
directly on standard input:

```bash
set -o pipefail
curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/deploy/install-update-reinstall-debian.sh | bash
```

No neighboring files need to be downloaded first. The entry script downloads the
complete `main` source archive from [this repository](https://github.com/nipegun/moe-gguf-server/), checks
it and synchronizes a managed copy in `/opt/moe-gguf-server-source`. Downloads
and build caches stay under the project's `_/temp/`. Curl and CA certificates
are needed to fetch the entry script; missing bootstrap dependencies are then
installed automatically.

Choose a different source directory and pass build options with:

```bash
curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/deploy/install-update-reinstall-debian.sh | LLAMA_INSTALL_SOURCE_DIR=/srv/moe-gguf-server-source bash -s -- --cpu --jobs 4
```

The remote directory must be absolute and on a local disk. The installer only
adopts an empty directory or reuses a copy bearing its source-origin marker;
unrelated directories are rejected. A lock prevents concurrent installation into
that copy. Subsequent `curl | bash` runs synchronize source files, including files
removed from `main`, while preserving `_/` and build caches. API keys, models and
deployed services live outside that source tree and are not changed. A failed
download or build does not install a new executable; rerun the same command to
retry. No Git operations are required.

A standalone downloaded script uses the same remote mode. Running
`bash deploy/install-update-reinstall-debian.sh` from a complete local checkout
builds that checkout without downloading sources. Arguments after `bash -s --`
are forwarded to the build installer. `--help` requires neither root nor a source
download. `--no-system-deps` also disables bootstrap package installation: curl,
CA certificates, tar, gzip, rsync, util-linux and coreutils must already exist.
Installer subprocesses cannot consume the script from the pipe; all phases share
one `/root/webapp-install.log` output stream.

Web configuration remains a separate step using
`/opt/moe-gguf-server-source/deploy/configure-web.sh` or its equivalent in the
chosen source directory.

Alpine still uses a complete local checkout and
`bash deploy/install-update-reinstall-alpine.sh`, with Bash installed first.
Debian defaults to CUDA/NCCL; Alpine defaults to CPU and does not support the
CUDA/NCCL installation path. Use `--cpu` for a Debian CPU build. CUDA Toolkit and
GPU drivers must already be installed. `--no-nccl` disables NCCL explicitly;
`--no-system-deps` leaves package management to the administrator.

The local UI needs Node.js 20.19+ on 20.x or 22.12+. `--no-ui` omits it. Other
options are `--jobs N`, `--prefix PATH`, `--build-dir PATH`,
`--cuda-architectures LIST`, `--no-openssl` and `--build-ui`.
`LLAMA_BUILD_DIR`, `LLAMA_SOURCE_STAGE_DIR`, `LLAMA_INSTALL_PREFIX`,
`LLAMA_BUILD_JOBS`, `LLAMA_BUILD_BACKEND` and `CUDACXX` provide corresponding
environment overrides. Build and staging directories must be distinct,
non-overlapping descendants of the project's `_/temp/` directory.

The installer adds matching NCCL packages and NVIDIA's repository when needed,
but never installs or upgrades CUDA Toolkit or GPU drivers. It links the internal
libraries statically and installs `/usr/local/bin/mgs`. Neither
installer uses or installs sudo.

On Debian/Ubuntu, `libnccl2` and `libnccl-dev` are installed together at the same
exact version selected for the detected CUDA release. This APT command uses
`--allow-downgrades` so a newer installed NCCL package does not block installation
of the selected version. The flag is only passed to the NCCL installation command.

If the distribution ships an older Node.js, install a supported version first.
The UI is compiled locally; upstream prebuilt assets are disabled by default
because they lack this project's translations and API routes. A failed UI build
stops installation.

From a complete local checkout, choose a CPU build or list installation options:

```bash
bash deploy/install-update-reinstall-debian.sh --cpu
bash deploy/install-update-reinstall-debian.sh --help
```

On Alpine, install Bash with `apk add --no-cache bash` before running its installer.

Run a single model with:

```bash
/usr/local/bin/mgs \
  --model /path/to/model.gguf \
  --host 127.0.0.1 \
  --batch-size 2048 --ubatch-size 2048 --metrics
```

Without `--gpu-layers`, `--n-cpu-moe` or `--override-tensor`, automatic fitting places the model on
the GPU and, when system memory allows, keeps the MoE experts in RAM so that the free VRAM becomes the
[MoE expert cache](#expert-cache). Adjust batch sizes and threads (`-t`, see [CPU threads](#threads)) to
your hardware. For CPU-only builds, omit the GPU options.

Open the HTTPS URL printed at startup, normally `https://127.0.0.1:11443/`.
Loading a large model may take time. The web
interface and API documentation remain available while model requests report
loading. `--help` lists the inherited engine options. GGUF files, GPU memory,
context length and model-specific projectors must match the intended workload.

The server code enables HTTPS by default for every build and installation method.
It binds the first available HTTPS port from 11443, then an HTTP redirect port
from 11080, skipping the chosen HTTPS port. HTTP responds with a permanent 308
redirect to the actual HTTPS port, preserving the requested host, path and query.
The log prints the selected URLs; port conflicts advance each sequence independently.
`--port N` fixes the main port and fails if occupied; `--port 0` lets the OS select
it. `--http-port N` changes the start of the redirect port search.
The corresponding environment variables are `LLAMA_ARG_PORT` and `LLAMA_ARG_HTTP_PORT`.

Without certificate files, the executable generates a self-signed certificate and
private key in memory on each startup, without requiring an external `openssl`
command. Browsers require a trust exception for this certificate. Supply both
`--ssl-cert-file /path/fullchain.pem` and `--ssl-key-file /path/privkey.pem` to use
a persistent certificate trusted by your clients. A missing or invalid pair stops
startup. Builds made with `--no-openssl` cannot serve HTTPS and require explicit
`--http` (or `LLAMA_ARG_HTTPS=false`); plain HTTP starts its port search at 11080.
Router children use explicit HTTP on private loopback ports. Unix sockets and
Vertex AI's `AIP_MODE=PREDICTION` retain their HTTP transport.

CMake configuration lives in `build/CMakeLists.txt`. Both installation and local
build scripts include `build/` in their source copy and select it automatically.
The installers reset generated CMake configuration if an existing cache points
to another source directory. Local builds always start in a fresh directory under
`/tmp/` and remove it on exit. For direct CMake use, run
`cmake -S build -B _/temp/cmake` from the project root; the usual installer and
local build commands remain the same.

<a id="local-build"></a>
## Local build for manual use

`build/build-local.sh` compiles the project on your own computer and installs a
self-contained copy for your user that you launch by hand. It installs no services, starts
nothing in the background, never uses root or sudo and never installs packages.
Run it as your regular user from any folder:

```bash
curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/build/build-local.sh | bash
```

The one-liner downloads the `main` source archive without Git into the private
build folder under `/tmp`. The archive and extracted sources are removed with
the other temporary build files on exit. A standalone copy of the script works
the same way. From a complete local project copy, build your local sources with:

```bash
bash build/build-local.sh
```

To pass options through the one-liner, use `bash -s --`; for example, a CPU build:

```bash
curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/build/build-local.sh | bash -s -- --cpu --jobs 4
```

`--help` shows the options without downloading the source archive or compiling.

The result is installed for your user under the `~/.local` prefix:

| path | content |
| --- | --- |
| `~/.local/bin/mgs` | The program you run: a small static launcher that finds `../lib/mgs/` relative to itself and starts the server through the bundled loader. |
| `~/.local/lib/mgs/` | The server binary (`mgs`, with the web interface and API documentation embedded) and every shared library it needs: the glibc dynamic loader and C library, the C++ runtime, OpenMP, OpenSSL, the glibc name-service modules and, in CUDA builds, the CUDA runtime, cuBLAS and NCCL. |
| `~/.local/share/doc/mgs/licenses/` | The project's MIT license (`LICENSE`) and the third-party license notices copied from the source tree's `build/licenses/`. |

Only the user who runs the script can use this installation. Everything is resolved relative to where the launcher
is: it runs `lib/mgs/ld-linux-x86-64.so.2 lib/mgs/mgs` from its prefix, and the server and its libraries search
`lib/mgs/` before anything else, including `LD_LIBRARY_PATH`. The only library still taken from the system is the
NVIDIA driver (`libcuda.so.1` and the `libnvidia-*` libraries it loads), because it must match the running kernel
module. At the end the script lists, through the bundled loader, the libraries the server would load, fails if any
comes from outside `lib/mgs/`, and runs `--version` through the launcher.

Debian adds `~/.local/bin` to the `PATH` at login once that folder exists (through `~/.profile`), so after logging in
again you can run `mgs` by name; the script prints a reminder while it is not in the `PATH`. Launch it whenever you
want and stop it with Ctrl+C:

```bash
mgs --model /path/model.gguf
```

The full path works too: `~/.local/bin/mgs --model /path/model.gguf`.

Open `https://127.0.0.1:11443/` for the chat and `https://127.0.0.1:11443/api/doc/` for
the API documentation. Every option in this manual applies; for example,
`--models-dir` enables the multi-model router.

Requirements, which you install yourself as root because the script only checks
them: `cmake`, a C/C++ compiler and the static C library (`build-essential`, which
pulls in `libc6-dev`), `patchelf`, `libssl-dev` (or
`--no-openssl`), Node.js 20.19+/22.12+ with npm (or `--no-ui`), an existing CUDA
Toolkit (or `--cpu`) and NCCL with its development files (`libnccl2` and
`libnccl-dev`, or `--no-nccl`). `nvcc` is taken from `CUDACXX`, the `PATH` or
`/usr/local/cuda/bin/nvcc`. Ninja is used when installed.
Basic utilities include `tar`, `coreutils` and `util-linux`. Remote builds also
require `curl`, `ca-certificates` and `gzip`; no dependencies are installed automatically.

Options: `--prefix PATH` (another installation prefix), `--jobs N`, `--cuda`, `--cpu`,
`--cuda-architectures LIST`, `--build-ui`, `--no-ui`, `--no-openssl`, `--no-nccl`
and `--help`.

Good to know:

- The build is optimized for this computer's CPU and for the GPUs present while
  compiling. Rebuild on each computer instead of copying the installation.
- The installation is relocatable as a prefix: move `bin/mgs` and `lib/mgs/` together, keeping their `bin/` and
  `lib/` levels. Always start `bin/mgs`; `lib/mgs/mgs` is internal and must not be run directly, because it would
  bypass the bundled loader.
- Rerunning the script updates the installation. It replaces only `bin/mgs`, `lib/mgs/` and
  `share/doc/mgs/licenses/`. A copy that is already running keeps working; restart it to use the new build.
- The script refuses a prefix where `bin/mgs`, `lib/mgs/` or that licenses folder already exist unless it created
  them; it leaves a hidden `.moe-gguf-server-bundle` marker in `lib/mgs/`.
- `--prefix PATH` installs under another prefix that your user can write to; it cannot be `/` or a folder inside the
  project.
- Staged sources, build files, caches, the assembled installation and the log use a
  private `/tmp/moe-gguf-server-build.XXXXXXXX/` folder. After copying the result
  to the prefix, the script removes that folder. It also cleans up on errors
  and handled interruptions. Each run compiles from scratch, without writing into
  the source tree or `/opt/`. Local builds do not accept `--build-dir`.
- The prefix is locked while copying and replacing completed artifacts,
  preventing simultaneous updates of the same installation.
- A CUDA build needs the NVIDIA driver to start; use `--cpu` on computers without it.

<a id="deployment"></a>
## Production deployment

From the source directory (`/opt/moe-gguf-server-source` for remote installs),
after installing the binary, run:

```bash
bash deploy/configure-web.sh --domain ai.example.com
```

The domain must resolve to the production host. The `moe-gguf-server-web`
service runs a dedicated Apache instance as `moe-gguf-server`, without root.
Every startup selects the first available HTTP port starting at 11080 and HTTPS
port starting at 11443. Each sequence advances independently up to 65535, without
assigning the same port to both protocols. It inspects IPv4/IPv6 TCP listeners
and retries if Apache detects a port becoming occupied after selection. Other
configuration failures stop startup instead of being mistaken for port conflicts.

HTTP permanently redirects to the selected HTTPS port, preserving path and query.
The redirect is not cached. Apache forwards requests to inference on
`127.0.0.1:8080`, explicitly started with `--http --port 8080` and also running as
`moe-gguf-server`. Installation requires root;
neither service needs to run as root. No HAProxy is configured and no shared
Apache sites are imported or modified.

Actual URLs are published after both listeners have opened:

```bash
cat /opt/moe-gguf-server/_/temp/web/ports.json
```

For example, HTTP 11081 and HTTPS 11445 redirect to
`https://ai.example.com:11445/`. The file is removed on shutdown and regenerated
at startup; a restart may choose different ports. Clients, firewalls and any
external proxy must use the published values. The port is part of the
[browser origin](https://developer.mozilla.org/en-US/docs/Glossary/Origin), so a
different HTTPS port has separate local history/settings. Existing conversations
remain in their original origin; export/import can transfer them.

The system account has no interactive password. Models are stored in
`/opt/moe-gguf-server/models`, with the API key in `/etc/moe-gguf-server/api.key`.
Credentials and installation output are recorded in `/root/webapp-credentials.txt`
and `/root/webapp-install.log`, both mode 600. Reconfiguration preserves existing
keys, models and certificates. The TLS private key is root-owned, group-readable
by moe-gguf-server (mode 640), allowing the unprivileged web process to read it.

Use your own TLS certificate with:

```bash
bash deploy/configure-web.sh --domain ai.example.com \
  --certificate /path/fullchain.pem --private-key /path/privkey.pem
```

Without supplied files, the script keeps an existing certificate or creates a
self-signed certificate. Trust it on your client or supply a certificate your
clients already trust. Supplied files are copied to
`/etc/moe-gguf-server/certificates/`; certificate renewal must refresh those copies
and restart `moe-gguf-server-web`. The script does not obtain or renew Let's Encrypt certificates.
Use the same command after renewing source certificates. The script's
`--binary` option supports a nondefault executable location.

The service uses router mode. Put readable GGUF models in
`/opt/moe-gguf-server/models`, or use model management in the interface. For
specialized command-line options, use a systemd override on Debian/Ubuntu or the
OpenRC service configuration on Alpine. Keep the backend bound to loopback.
The web configurator regenerates its managed service file when rerun.

When upgrading an installation that used the old `llama-server` executable,
rerun `deploy/configure-web.sh --domain DOMAIN` after installing `moe-gguf-server`
to update the executable path in the service configuration.



Restart the web service to select ports again:

```bash
systemctl restart moe-gguf-server-web
```

On Alpine use `rc-service moe-gguf-server-web restart`. Startup logs are in
`journalctl -u moe-gguf-server-web` on Debian or `/var/log/moe-gguf-server-web.log`
on Alpine. Apache diagnostics are in `/opt/moe-gguf-server/_/temp/web/startup.log`
and `error.log`; domain access logs remain in `/var/www/DOMAIN-logs/`. The standalone
template is `/etc/moe-gguf-server/apache2.conf.in`. Do not edit the generated
configuration in `_/temp/web/`; it is rebuilt on every startup.

<a id="chat"></a>
## Using the interface

1. Open the server URL and enter its API key when prompted, or in Settings → General.
2. Select a model. In router mode, load an available model if none is loaded.
3. Type a message and send it. Enter sends by default; Shift+Enter inserts a line
   break. These shortcuts can be changed in settings.
4. Add files with the attachment action. Images, audio and video require compatible
   model modalities. PDF files can be extracted as text or converted to images;
   non-vision models use the text path.
5. Stop generation, skip reasoning when supported, edit a message, regenerate a
   response, or fork a conversation using the message actions.

The sidebar supports searching, pinning, renaming, deleting and bulk selection.
Conversations and settings are stored in the browser using IndexedDB and
localStorage; they are not a server account database. Export them before clearing
browser storage or changing browser profiles. Import/export is available in
settings. Exports can contain attachments and, if explicitly selected, sensitive
API keys or MCP authorization headers.

Choose the language in Settings → General. Options are ordered `en-GB`, `en-US`,
`es-AR`, `es-ES`; the default is `en-US`. Changing language saves the choice and
reloads the interface. Save other pending settings first. The `lang` URL query
parameter also supports language selection if browser storage is unavailable.
Choose System, Light or Dark for the theme. Generation settings include context
usage, temperature, samplers, penalties and agentic turn limits. Some capabilities
depend on server flags or the selected model.

<a id="models"></a>
## Models, tools and MCP

The model selector shows available, loaded and favorite models. Model details
include context size, modalities, quantization and the chat template. Router mode
manages separate child processes for loaded models; requests identify the model
through the `model` field or query parameter.

MCP servers are configured by URL with optional authorization headers. You can
inspect connection logs, available prompts, resources and tools. The optional
server CORS proxy must be explicitly enabled using the engine's corresponding
flag. Browser restrictions on HTTP resources within HTTPS pages still apply.
The server's built-in tools and the browser JavaScript sandbox are optional.
Tool approvals and the agentic turn limit remain available in the interface.

Streams can reconnect using the saved conversation identity and cursor while the
server retains the stream. A stopped server or expired stream cannot provide a
guaranteed replay. The interface reports a failed reconnection rather than
silently creating a second generation request.

<a id="api"></a>
## HTTP API

Examples use 11443; substitute the HTTPS port from `ports.json` if different.

The default API root is `/api`. The UI remains at `/`. The root `/v1/...` routes
from the original server are no longer registered. OpenAI-compatible clients must
use `https://ai.example.com:11443/api/v1` as their base URL. Request/response field names
and the C/C++ engine interfaces retain upstream compatibility.

```bash
curl https://ai.example.com:11443/api/v1/chat/completions \
  -H "Authorization: Bearer ${LLAMA_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"model":"model-id","messages":[{"role":"user","content":"Hello"}]}'
```

Set `LLAMA_API_KEY` to the installed key in your own shell. Native operations,
embeddings, tokenization, reranking, model management and resumable streams are
documented in the bundled Swagger UI at `/api/doc/`; its OpenAPI JSON is at
`/api/doc/openapi.json`, generated by the server on each request without a static JSON file. The inventory reflects the routes registered by the
running process, including router and optional compatibility routes. Disabled
features may return 403. A missing/invalid key returns 401 and model loading
returns 503. Health and model list routes retain public access.

`--api-prefix /api/custom` relocates inference routes below `/api/custom`.
The root UI receives that prefix from `/api/config.js`; docs remain at `/api/doc/`.
The documentation namespace is reserved and cannot be used as an inference
prefix. Router children use `/api` internally. The server validates prefixes;
values outside `/api/` and paths with trailing slashes are rejected.

<a id="performance"></a>
## Memory and performance

Host memory registration and expert prefetch are enabled by default. Prefetch
overlaps expert transfers with computation, particularly for large prompts.
Results depend on the model, memory capacity and RAM/PCIe bandwidth.

For models with CPU-offloaded experts, `--cpu-moe` or `--n-cpu-moe N` can reduce
VRAM use. Host registration pins mapped weight pages for faster host-to-device
copies. Pinned memory cannot be paged out, so leave enough RAM for the operating
system. This registration path is POSIX-specific; Windows retains its earlier
loading behavior. `--load-mode none` is recommended only when host registration fails
wholly or partly, not as a normal requirement.

Expert prefetch defaults to three VRAM slots. Each slot must fit the largest
transferred expert tensor. Values 2–8 in `GGML_SCHED_PREFETCH_EXPERTS` explicitly
choose a slot count. If memory allocation fails, at least two allocated slots are
kept when possible; otherwise regular transfers are used. Prefetch starts only
when the batch has at least twice as many expert selections as experts. Its pool
belongs to the first GPU that activates it; other GPUs keep selective copies.
Larger batches can help prefill but require more memory.

For diagnostics, set `GGML_CUDA_REGISTER_HOST=0` or
`GGML_SCHED_PREFETCH_EXPERTS=0` to disable the corresponding optimization.
Do not set those variables during normal operation unless intentionally opting out.

Automatic MTP examines GGUF metadata and tensor names before weight allocation,
including every shard. It requires a supported architecture, a model trunk and
all integrated heads. An external head or unsupported architecture does not
activate it. The default draft limit is three tokens. Explicit `--spec-type`
selection takes precedence; `--no-spec-mtp-auto` and `--spec-type none` disable
automatic selection. `--spec-draft-n-max` changes the limit. MTP affects generation,
not prefill or time to first token directly. Improvement depends on acceptance
rate and hardware; increasing the limit does not guarantee more speed.

<a id="mtp-vram"></a>
MTP weights always stay in GPU memory when the GPU can hold them: the MTP layers grafted onto the model, a
separate MTP GGUF passed with `--spec-draft-model`, and the output head they use. The options that move weights to
system memory (`--cpu-moe`, `--n-cpu-moe`, `--override-tensor`, their `--spec-draft-*` equivalents and automatic
fitting) do not apply to them, and they stay on the GPU even with a low `--gpu-layers`. Automatic fitting places the
rest of the model around them, and the [MoE expert cache](#expert-cache) uses the memory left after that. If the MTP
layers do not fit in the free GPU memory with a 512 MiB margin, the log shows a warning and they are placed like any
other layer. With a separate MTP GGUF, the MTP layers grafted onto the main model are not loaded, so they do not take
memory twice; with `--spec-type none`, no MTP weight is loaded. The load log confirms the placement with a line such
as `keeping the MTP weights in CUDA0 (1 layers, 856.36 MiB)`.

<a id="expert-cache"></a>
### MoE expert cache

When MoE experts stay in system memory and the rest of the layer runs on a GPU, the server keeps the most
recently used experts of all layers in a cache that takes the free VRAM;
with several GPUs, every GPU caches the layers assigned to it in its own VRAM. For every generated token (and any
batch below 32 tokens), the experts found in the cache run on the GPU, a share of the missing ones is uploaded
to the cache and the rest runs on the CPU at the same time; the share follows the measured PCIe and CPU
bandwidths. Long prompts keep the expert prefetch, which now copies the cached experts inside the GPU and only
uploads the others. The output matches the run without cache up to rounding. The GPU and the CPU round differently and the experts
each one computes depend on the cache contents, so a long greedy generation can drift to a different but equally
valid text after some tokens, from one run to the next; the cache of the official llama.cpp behaves the same way.

The cache is enabled by default and is created by the first request, once the model, the MTP context and the
multimodal projector are loaded. Without `--gpu-layers`, `--n-cpu-moe` or `--override-tensor`, automatic
fitting keeps every expert in system memory when it fits with a margin (4 GiB or 10% of the RAM) and leaves the free VRAM to the cache (with several GPUs, it spreads the layers over
them by their free memory so every GPU has a cache); otherwise it places whole expert layers on the GPU as before and the cache uses what
remains. Explicit placement options are respected: `--cpu-moe` gives the cache the most VRAM and
`--n-cpu-moe N` keeps some static layers on the GPU. The experts kept in RAM are pinned, so the RAM must hold
all of them plus the operating system.

| Option | Variable | Effect |
| --- | --- | --- |
| `--moe-cache`, `--no-moe-cache` | `LLAMA_MOE_CACHE` (`0` disables) | Enable or disable the cache (enabled by default). |
| `--moe-cache-size MiB` | `LLAMA_MOE_CACHE_MIB` | Fixed total cache size, split among the GPUs by the experts each one caches; `-1` (default) uses the free VRAM of every GPU. |
| `--moe-cache-reserve MiB` | `LLAMA_MOE_CACHE_RESERVE_MIB` | VRAM left free on every GPU besides the cache and the prefetch slots (default 1024). Increase it when other programs use the GPU. |
| — | `LLAMA_MOE_CACHE_FILL_RATIO` | Diagnostics: fixed share (0–1) of missing experts uploaded instead of the measured balance. |
| — | `LLAMA_MOE_CACHE_STATS` | Diagnostics: log the cache counters every N decoding steps (visible with `-lv 4`). |

`GET /api/expert-cache` returns the size, cached layers and slots, hits and misses, uploads, CPU experts, the
share of prefetch bytes served from the cache and the measured bandwidths (with several GPUs,
sizes and counters add up and the upload bandwidth is their mean). `POST /api/expert-cache` with
`{"size_mib": N}` changes the size without restarting (`-1` automatic, `0` frees the cache); the next request
applies it and starts with an empty cache:

```bash
curl -H "Authorization: Bearer ${LLAMA_API_KEY}" https://127.0.0.1:11443/api/expert-cache
curl -H "Authorization: Bearer ${LLAMA_API_KEY}" -H 'Content-Type: application/json' \
  -d '{"size_mib": 2048}' https://127.0.0.1:11443/api/expert-cache
```

With `--metrics`, `/api/metrics` adds `llamacpp:moe_cache_*` counters and gauges (steps, hits, misses, uploads,
CPU experts, prefetch bytes, size, slots and bandwidths).

Reference measurement on an RTX 4060 Ti 16 GB with Qwen3.6-35B-A3B Q8_0 (35 GiB, 8 CPU threads), compared with
`--n-cpu-moe 28` without cache: generation 26.9 → 35.7 tokens/s (+33%), prompt processing 767–778 →
718–730 tokens/s (−6%), and with MTP enabled 33.6 → 47.0 tokens/s (+40%). On the same machine, the official
llama.cpp with its own cache (`-cmoe --moe-cache-mib 10240`) reached 26.7 tokens/s, and 27.8 with MTP. Gains depend on the share of experts
that fits in VRAM, the routing locality of the model and the PCIe and RAM bandwidths.

<a id="threads"></a>
### CPU threads

The CPU computes the experts that are not in the cache, and every operation waits for its slowest thread. In
virtual machines, or when other programs share the CPU, fewer threads than cores can be much faster: on the
reference machine (16 virtual cores with a desktop session) `-t 8` raised generation without cache from 13.9
to 26.9 tokens/s and with cache from 20.3 to 34.9 tokens/s. Try `-t` values between half and all of the
physical cores.

<a id="checkpoints"></a>
### Context checkpoints

Models with recurrent or sliding-window layers (for example Qwen3.5/3.6/3.8 hybrids, Nemotron-H, Granite 4 or
Gemma with SWA) cannot roll their state back, so when a request changes an earlier part of the conversation the
server resumes from the newest checkpoint before the change. Checkpoints are placed at the start of user,
assistant and tool messages (where coding agents remove old reasoning or trim old tool results) and at least
every `--checkpoint-min-step` tokens (default 1024, previously 8192) without extra prompt passes. When
`--ctx-checkpoints` (32) is reached, the checkpoint closest to its neighbours is removed, so the others stay
spread over the conversation. In the reference agent scenario (14k tokens, eight tool results), trimming a late
tool result went from 19.3 s to 5.5 s and an early one from 18.0 s to 13.6 s. Each checkpoint keeps the
recurrent or sliding-window state in host memory (63 MiB for Qwen3.6-35B-A3B).

<a id="upstream-options"></a>
### Updated options and diagnostics

Keep the default `--load-mode mmap` when host registration succeeds. Use `--load-mode none` only as a fallback when registration fails. `--load-mode dio` now stages reads through at most 64 MiB of extra memory; that is not a cap on total model RAM.

`GGML_CUDA_PEER_MAX_BATCH_SIZE` was removed because it had no runtime effect. The old loading flags (`--mmap`, `--no-mmap`, `--mlock`, `--direct-io`, `--no-direct-io`) and the `GGML_CUDA_FA_ALL_QUANTS` build flag are no longer accepted; see [removed compatibility](#removed-compatibility) for their replacements. For a manual CMake build, `-DGGML_CUDA_FA_QUANTS=q8_0-q4_0` adds that K/V vector-kernel combination; comma-separated or quoted semicolon-separated lists are accepted. The default list is `q4_0-q4_0;q8_0-q8_0;f16-f16;bf16-bf16`; F16 is always included. `all` increases compilation work. Missing vector-kernel combinations use an F16 conversion fallback and may be slower.

Complete single-head GLM-4.5-Air (`glm4moe`) GGUFs can now activate automatic MTP. Other existing eligibility checks and explicit-option precedence still apply. MTP separates graphs with/without outputs, preserves original token order across concurrent sequences, and uses actual positions after images.

Automatic fitting counts the nextn (MTP) layers, so the first layer no longer stays on the CPU when MTP is disabled. MTP weights now always stay in GPU memory; see [MTP placement](#mtp-vram). The default `--checkpoint-min-step` is now 1024 instead of 8192; see [context checkpoints](#checkpoints). `--moe-cache`, `--no-moe-cache`, `--moe-cache-size` and `--moe-cache-reserve` control the [MoE expert cache](#expert-cache).

With `--metrics`, authenticated `GET /api/metrics` includes `llamacpp:spec_decode_num_draft_tokens_total`, `llamacpp:spec_decode_num_accepted_tokens_total`, `llamacpp:spec_decode_num_drafts_total`, and `llamacpp:spec_decode_num_accepted_tokens_per_pos_total{position="N"}`. Position indices start at zero; that series appears after a speculative request completes. Compare deltas of accepted/drafted counters when evaluating acceptance, and measure latency separately; acceptance alone does not prove a speedup. In router mode, select the model with `?model=MODEL_ID`.

Conversation exports read the persisted full message tree and metadata. If server tools return 403, new messages stop repeating that failed lookup; reopening the tools panel retries it. First-visit server defaults preserve settings already changed by the user, including the API key.

[Implementation and upstream sources](CODE.md#upstream-review).

<a id="removed-compatibility"></a>
## Removed compatibility

Backward-compatibility shims have been removed. Old names are no longer
translated or warned about: the server rejects removed command-line options as
invalid arguments, ignores removed environment variables and answers 404 for
removed routes. Update scripts, service overrides, presets and clients to the
replacements below.

| Removed | Use instead |
| --- | --- |
| `--mmap` / `--no-mmap` | `--load-mode mmap` / `--load-mode none` |
| `--mlock` | `--load-mode mlock` (or `mmap+mlock` to combine both) |
| `-dio`, `--direct-io` / `-ndio`, `--no-direct-io` | `--load-mode dio` / `--load-mode none` |
| `-dt`, `--defrag-thold` | Nothing; it had no effect. |
| `--swa-checkpoints` | `-ctxcp`, `--ctx-checkpoints` |
| `--webui`, `--no-webui`, `--webui-config`, `--webui-config-file`, `--webui-mcp-proxy`, `--no-webui-mcp-proxy` | `--ui`, `--no-ui`, `--ui-config`, `--ui-config-file`, `--ui-mcp-proxy`, `--no-ui-mcp-proxy` |
| Old draft-model aliases such as `-md`/`--model-draft`, `-ngld`/`--gpu-layers-draft`, `-td`/`--threads-draft`, `-devd`/`--device-draft`, `-ctkd`/`--cache-type-k-draft`, `-hfd`/`--hf-repo-draft` or `--draft-p-min` | The matching `--spec-draft-*` option, for example `--spec-draft-model`, `--spec-draft-ngl`, `--spec-draft-threads`, `--spec-draft-device`, `--spec-draft-type-k`, `--spec-draft-hf` or `--spec-draft-p-min`. `mgs --help` lists all of them. |
| `--draft`, `--draft-n`, `--draft-max` / `--draft-min`, `--draft-n-min` | `--spec-draft-n-max` or `--spec-ngram-mod-n-max` / `--spec-draft-n-min` or `--spec-ngram-mod-n-min` |
| `--spec-ngram-size-n`, `--spec-ngram-size-m`, `--spec-ngram-min-hits` | The `--spec-ngram-*-size-n`, `--spec-ngram-*-size-m` and `--spec-ngram-*-min-hits` option of the chosen n-gram mode |
| `LLAMA_ARG_NO_<NAME>` environment variables | `LLAMA_ARG_<NAME>=false` |
| `LLAMA_ARG_MMAP`, `LLAMA_ARG_MLOCK`, `LLAMA_ARG_DIO` | `LLAMA_ARG_LOAD_MODE` |
| `LLAMA_ARG_DRAFT_MAX`, `LLAMA_ARG_DRAFT_MIN`, `LLAMA_ARG_DEFRAG_THOLD` | `LLAMA_ARG_SPEC_DRAFT_N_MAX`, `LLAMA_ARG_SPEC_DRAFT_N_MIN`; nothing for the defragmentation threshold |
| `HF_ENDPOINT` | `MODEL_ENDPOINT` |
| `HUGGINGFACE_HUB_CACHE` | `HF_HUB_CACHE` or `LLAMA_CACHE` |
| `POST /api/completion` | `POST /api/completions` |
| `POST /api/embedding` | `POST /api/embeddings` or `POST /api/v1/embeddings` |
| `POST /api/reranking`, `POST /api/v1/reranking` | `POST /api/rerank`, `POST /api/v1/rerank` |
| `reasoning_format` value `deepseek-legacy` (request field and `--reasoning-format`) | `deepseek` or `auto`; reasoning is returned in `reasoning_content` |
| `reasoning_budget_end_tag` request field | `reasoning_budget_end_tags` (array of strings) |
| `reasoning_in_content` in `generation_settings` | Nothing; the field was removed. |
| CMake `LLAMA_CUDA`, `LLAMA_CUBLAS`, `LLAMA_METAL`, `LLAMA_METAL_EMBED_LIBRARY`, `LLAMA_NATIVE`, `LLAMA_RPC`, `LLAMA_SYCL`, `LLAMA_SYCL_F16`, `LLAMA_CANN` | The matching `GGML_*` option, for example `GGML_CUDA` or `GGML_NATIVE` |
| CMake `LLAMA_CURL` | Nothing; it was already ignored. |
| CMake `LLAMA_BUILD_WEBUI`, `LLAMA_USE_PREBUILT_WEBUI`, `LLAMA_WEBUI_HF_BUCKET` and the `HF_WEBUI_VERSION` environment variable | `LLAMA_BUILD_UI`, `LLAMA_USE_PREBUILT_UI`, `LLAMA_UI_HF_BUCKET`, `HF_UI_VERSION` |
| CMake `GGML_CUDA_FA_ALL_QUANTS=ON` | `GGML_CUDA_FA_QUANTS=all` |
| `bash install/install.sh` | `bash deploy/install-update-reinstall-debian.sh` |
| Installer option `--no-sudo` | Nothing; the installers always run as root without sudo. |

CMake reports removed `-D` variables as unused instead of applying them, so check
the configuration output of manual builds.

The web interface no longer reads or migrates data saved by older versions:
settings and conversations under the old `LlamaCppWebui` storage prefix and the
`LlamacppWebui` database, the standalone `theme` key, inline reasoning and tool-call
markers in old messages, pasted-text attachments of the old `context` type, the old
list format of dismissed MCP recommendations and the server's former
`webui_settings` field. Data that a previous version already migrated remains
available. Conversation import accepts only the JSONL and ZIP exports; the old JSON
export format is rejected.

`deploy/configure-web.sh` no longer disables the `llama-server-moe` site that
early deployments added to the system Apache (`sites-enabled/llama-server-moe.conf`
on Debian/Ubuntu, `conf.d/zz-llama-server-moe.conf` on Alpine). If one of these
files still exists, disable or remove it manually and reload Apache.

The project was renamed from `llama-server-moe` to `moe-gguf-server`, and the executable is now `mgs`.
Installations made under the old name are not migrated. Reinstalling creates the `moe-gguf-server` and
`moe-gguf-server-web` services, the `moe-gguf-server` account and the `/opt/moe-gguf-server` and
`/etc/moe-gguf-server` folders next to the old ones. After reinstalling, move the models from
`/opt/llama-server-moe/models` to `/opt/moe-gguf-server/models` and give them to the new account
(`chown -R moe-gguf-server:moe-gguf-server /opt/moe-gguf-server/models`); to keep the API key, copy
`/etc/llama-server-moe/api.key` over `/etc/moe-gguf-server/api.key` and restart both new services. Then stop,
disable and remove the
`llama-server-moe` and `llama-server-moe-web` services, `/usr/local/bin/llama-server-moe`,
`/usr/local/libexec/llama-server-moe`, the old folders and the `llama-server-moe` account. Local builds now install into
`~/.local` (`bin/mgs` and `lib/mgs/`); the old `~/IA/Apps/llama-server-moe/` folder can be deleted.

### Old model files

Compatibility code for the following old conversions was also removed.
Re-convert the original model, or download a current GGUF, to use them.

| Old file | Behaviour now |
| --- | --- |
| Grok-1 converted before August 2025 (without `grok.logit_scale`, `grok.embedding_scale`, `grok.attention.output_scale` or `grok.attn_logit_softcapping`) | Does not load: missing key. |
| MiniCPM 1B/2B and MiniCPM-MoE-8x2B without `minicpm.embedding_scale`, `minicpm.residual_scale` and `minicpm.logit_scale` | Does not load: missing key. |
| Early GLM-4.7-Flash conversions without `deepseek2.expert_gating_func` | Loads, but selects experts with softmax instead of sigmoid, which degrades the output. |
| Kimi-Linear with the unsplit `blk.N.attn_kv_b` tensor | Does not load: `attn_k_b`/`attn_v_b` are missing. That path already failed while building the graph. |
| 2023 extended-context models that only carry `rope.scale_linear` (for example LLaMA-2-7B-32K or Vicuna-v1.5-16k) | Loads without RoPE scaling, so long contexts work poorly. |
| Gemma 2 converted before `gemma2.attention.sliding_window` existed (late June and early July 2024) | Does not load: missing key. |
| MiniCPM-Llama3-V 2.5 mmproj without `clip.minicpmv_version` (before mid-August 2024) | The projector does not load. |

Fallbacks that current conversions still depend on were kept: the default
`add_bos` of the Llama 3, Tekken and similar pre-tokenizers, the forced BOS of
Gemma 4, the softmax default of old DeepSeek V2/V2.5 files, the optional T5 keys
and the MiniCPM-V `query_num` fallback.

<a id="maintenance"></a>
## Maintenance and troubleshooting

- Repeat `curl | bash` to update from `main`, or the appropriate local installation command to rebuild and replace the binary.
  Restart the service afterward: `systemctl restart moe-gguf-server` on Debian,
  or `rc-service moe-gguf-server restart` on Alpine.
- Read `/root/webapp-install.log`, `journalctl -u moe-gguf-server` on Debian,
  or `/var/log/moe-gguf-server.log` on Alpine. Apache logs live under
  `/var/www/DOMAIN-logs/`.
- If CUDA compilation is unavailable, install the Toolkit externally or use
  `--cpu`. If NCCL cannot be found, check repository availability and CUDA version,
  or explicitly choose `--no-nccl`.
- If UI compilation fails, check Node.js and npm versions, dependency downloads
  and the log. Do not substitute an upstream prebuilt interface.
- For deploy builds, use a fresh directory inside `_/temp/` after source layout changes.
  A project copy on SSHFS may prohibit executables; use a local disk on production.
- For the local build, rerun the one-liner above to download current `main`, or
  `bash build/build-local.sh` to use your local sources, and restart the copy you
  launched by hand. Read the terminal output if it fails or reports libraries
  outside `lib/`. The temporary `build.log` is deleted with the build directory.
- API 404 errors in older clients usually require changing the base URL to
  `/api/v1`. The installed API key belongs in the Authorization header.

No tests, deployment runs, GPU benchmarks or automated mobile browser checks are
performed by the coding assistant under this project's rules. Static syntax
checks are not a guarantee of runtime behavior. See [CODE.md](CODE.md) for the
implementation map and extension points.
