# Technical guide

[Architecture and decisions](#architecture) · [Module map](#modules) · [Key symbol index](#symbols) · [Main call paths](#flows) · [Entry points and routes](#routes) · [Impact analysis](#impact) · [Extension points](#extensions) · [Upstream review — 2026-10-02](#upstream-review)

<a id="architecture"></a>
## Architecture and decisions

`frontend/` contains the UI; `backend/` the engine, server and dependencies;
`deploy/` installers, services and asset scripts; `build/` the local
self-contained build script and its relocatable launcher; `doc/` documentation; `_/` local working material. Imported public interfaces and dependencies are preserved.

The Svelte interface lives in `frontend/`, the C++ engine/server in `backend/`, and installation in `deploy/`. The engine retains the relative relationships between `src/`, `common/`, `include/`, `ggml/`, `vendor/` and `tools/` to preserve upstream targets and API/ABI. The CMake entry point in `build/CMakeLists.txt` delegates to the backend; the UI library is built from `frontend/` and embedded in the executable. The internal `llama-server` target sets `OUTPUT_NAME mgs`; both build output and installation use `mgs`.

HTTP registration applies the API prefix to each published route. Handlers receive canonical paths without the prefix; the router adds `/api` when forwarding to model children. Public authentication allowlists use complete external paths. The UI stays at `/`; `/api/config.js` publishes the prefix before application modules load. Swagger and OpenAPI live under `/api/doc/`, including during model loading. The route/method registry supplies the live inventory; completion parameters come from `server-schema`.

JSON catalogs hold interface translations. `fTranslate` interpolates named values without modifying conversation data. Changing language reloads the interface so labels calculated at module import also change. Framework contracts, protocol fields and imported symbols retain their original names; project-owned functions follow the required naming prefixes.

Installation requires root, handles command failures explicitly and stages only under `_/temp/`. The UI is built locally instead of downloading an upstream interface lacking project changes. Deployment creates unprivileged inference and web services. Its dedicated Apache instance searches HTTP ports from 11080 and HTTPS from 11443 on every startup; inference stays on loopback:8080. No HAProxy is configured. Conversations live in the browser; there is no backend user database.

The server itself enables HTTPS by default: `common_params` starts at 11443 and `server_http_context` binds the first free port, followed by HTTP from 11080. The second listener returns 308 to the selected HTTPS port, preserving host, path and query, with `Cache-Control: no-store`. `--port` fixes the main port (0 delegates to the OS); `--http-port` changes the HTTP search start. Only address-in-use conflicts advance the search; other errors stop startup. `server-tls.cpp` loads the supplied PEM pair or generates an in-memory, self-signed ECDSA P-256 certificate with SANs for localhost, loopback and the configured host. Each process gets a fresh identity without invoking an external command. Without OpenSSL support, HTTPS fails explicitly. `--http` selects deliberate plain HTTP, used by router children and the Apache backend on 8080; Unix sockets and Vertex AI retain HTTP. The destructor stops and joins both listeners. These decisions live in C++, independently of installers and launchers.

`build/build-local.sh` covers manual use on a workstation: it needs no root, installs no packages or services and leaves nothing running. It copies a complete local source tree or downloads the GitHub `main` archive without Git when invoked through `curl | bash` or as a standalone script, builds the `llama-server` target in `/tmp/moe-gguf-server-build.XXXXXXXX/` and installs a relocatable, self-contained copy under a prefix (default `~/.local`, only for the current user; `--prefix` changes it): `bin/mgs`, `lib/mgs/` and `share/doc/mgs/licenses/`. `lib/mgs/` holds the server binary, its transitive `ldd` closure, the glibc dynamic loader and the NSS modules that glibc opens with `dlopen`. The kernel only honors an absolute `PT_INTERP`, so `bin/mgs` is a static launcher (`build/mgs-launcher.c`) that reads `/proc/self/exe`, goes up from `bin/` to the prefix and executes `lib/mgs/<loader> lib/mgs/mgs` with the remaining arguments; nothing in the prefix depends on its absolute location. The server binary and bundled libraries carry `DT_RPATH` `$ORIGIN`, deliberately chosen because it outranks `LD_LIBRARY_PATH`. Since the server's process image is then the loader, the launcher exports `MGS_EXECUTABLE` and `get_server_exec_path` returns it, so router children re-enter through the launcher. NVIDIA driver libraries (`libcuda`, `libnvidia-*`) are never bundled because they must match the kernel module. A marker file inside `lib/mgs/` prevents replacing an installation that the script did not create.

Each local run uses a fresh private directory from `mktemp -d /tmp/moe-gguf-server-build.XXXXXXXX`. The downloaded archive, its member list, copied or extracted sources, CMake output, npm/Node/CUDA caches, scratch files, the log and the assembled `bundle/` stay there. Automatic compiler caching is disabled (`GGML_CCACHE=OFF`, `CCACHE_DISABLE=1`), so no cache server survives the build. Once the artifacts are ready, the script locks the prefix directory itself with `flock`, copies the finished files to temporary entries next to their final places, then renames them into place on the same filesystem. `fCleanup` waits for the log writer and removes the private workspace on success, failure and handled INT/TERM/HUP signals. No build files are written into the source tree or `/opt/`; the local builder has no `--build-dir` option.

The entry script path is captured with `${BASH_SOURCE[0]:-}` before calling `fMain`, so stdin execution also works with `set -u`. Options are parsed before source discovery; `--help` needs neither a source tree nor a source download. `fHasProjectSources` checks the build entry points, launcher, frontend manifests and license directory. A complete local copy is staged with the existing exclusions. Otherwise, `fDownloadSources` requires existing curl/gzip, downloads over HTTPS with retries, validates the archive paths and extracts into the private `source/` directory before checking the required files. `fMain` runs with stdin redirected from `/dev/null`, so build tools cannot consume the piped script. Remote options use `bash -s --`; packages are never installed.


The Debian entry point is standalone: it detects a complete local checkout or downloads `main` from GitHub. Remote mode uses `/opt/moe-gguf-server-source` (overridden by `LLAMA_INSTALL_SOURCE_DIR`), checks the source-origin marker and holds a lock across synchronization and compilation. `rsync --checksum --no-times --delete` removes obsolete sources, preserves `_/` and gives changed files fresh timestamps. The helper runs in a separate Bash with stdin closed and without duplicating its parent log stream.

No backward-compatibility layer is kept. Deprecated CLI aliases and removed-option tombstones, `LLAMA_ARG_NO_*` environment fallbacks, legacy HTTP route aliases (`/completion`, `/embedding`, `/reranking`), the `deepseek-legacy` reasoning format, old CMake variable names, browser-data migrations and installer shims were removed, so each option, route, variable and stored value has a single current name. The exceptions are deliberate: the public llama/GGML/mtmd C API and ABI (including symbols marked deprecated), loading GGUF files through fallbacks that current conversions still depend on (the old-file shims for Grok-1, MiniCPM, early GLM-4.7-Flash, the unsplit Kimi-Linear `attn_kv_b`, `rope.scale_linear`, early Gemma 2 and the MiniCPM-Llama3-V 2.5 mmproj were removed), toolchain and operating-system version guards, and interoperability with external protocols (OpenAI, Anthropic, TEI/Jina, GCP Vertex, MCP).

Configure manually with `cmake -S build -B _/temp/cmake` from the project root. Build scripts stage `build/` alongside the sources and select `source/build` as the CMake source directory. Deploy scripts keep generated files under `_/temp/` and reset `CMakeCache.txt` and `CMakeFiles/` if a cached configuration points to another source directory. The local build always uses a fresh disposable workspace under `/tmp/`.

Formatting configuration is scoped to folders: `.clang-format` is present in `backend/`, `frontend/` and `build/`; `.editorconfig` is present in those folders plus `deploy/` and `tests/`. License notices in `build/licenses/` inherit `build/.editorconfig`. Keep equivalent settings in sync. Files in the project root and `doc/` require editor settings for UTF-8, LF and two-space indentation.

The `doc/` folder contains reading documentation. The Swagger page lives in `frontend/api.html` and CMake embeds it in the server. The backend generates `/api/doc/openapi.json` from registered routes on each request; there is no static `openapi.json` source file.

The fork retains llama.cpp's server, multimodal support and GGML backends, with
MoE optimizations for weights split between GPU memory and system RAM. Host
registration and expert prefetch derive from
[host-register](https://github.com/thecodacus/llama.cpp/tree/fable5/host-register)
and [prefetch-experts](https://github.com/thecodacus/llama.cpp/tree/fable5/prefetch-experts).
The prefetch slots hold gate/up/down expert tensors and overlap their transfers
with computation. Automatic MTP checks `nextn_predict_layers`, the model trunk
and all integrated heads before selecting `draft-mtp`; the checks include every
GGUF shard. See the [manual](MANUAL.md#performance) for tuning and limitations.

**MoE expert cache.** `backend/src/llama-expert-cache.{h,cpp}` keeps the most recently used experts of
every layer whose experts stay in system memory in one device pool per GPU shared by the layers assigned to it (one LRU list per
group of layers of the same GPU with identical per-expert tensor types and shapes). A slot holds every per-expert tensor of one
expert: weights, biases and per-expert scales, with separate or merged gate/up projections. For micro-batches
below the op-offload limit (32 tokens, `GGML_OP_OFFLOAD_MIN_BATCH`), `build_moe_ffn` builds the expert chain
twice: a device branch that reads the pool through slot identifiers and a CPU branch that reads the host
weights. A CPU partition operation (`mPartition`) runs first: it counts the hits, uploads a bandwidth-balanced
share of the misses (about m·B_upload/(B_upload+B_cpu), at least one) and queues the slot identifiers and the
uploads on the device stream before the device branch; the CPU branch then computes the remaining misses at the
same time. Experts handled by the other branch get identifier -1 on the CPU (the CPU `mul_mat_id`/`add_id`
kernels skip them and write zeros) and an empty slot on the device (position k uses empty slot k, so no slot
repeats within a token, as the CUDA MMQ helper requires), so the sum of both branches equals the regular
execution up to rounding. The scheduler only synchronizes an input-free split with the previous split when that
split had copied inputs or its backend can access the current buffer type; this keeps the fix of upstream
#26040 and lets both branches overlap. The upload bandwidth is measured at creation with real experts and the
CPU bandwidth is estimated online from the CPU branch duration. Large micro-batches keep the expert prefetch:
`ggml_backend_sched_set_weight_upload` lets the cache copy its experts device-to-device into the prefetch slot
and upload only the others from host memory. The cache takes the device memory left after the context minus
`--moe-cache-reserve` and the prefetch slots. It is created by the first request after every context and
projector is loaded (the common warmup defers it), can be resized at run time (`llama_set_expert_cache_size`,
`POST /api/expert-cache`) and reports its counters through `llama_get_expert_cache_info`, `/api/expert-cache`
and `/api/metrics`. Settings travel through `LLAMA_MOE_CACHE*` environment variables, set by the
`--moe-cache*` options, which keeps the public API unchanged. With the cache enabled and enough
RAM, `--fit` keeps every expert in system memory and leaves the free device memory to the cache, because an LRU
cache serves decoding better than whole static expert layers; with several GPUs it spreads the dense-only layers
over them by memory target, so every GPU caches the experts of its own layers. The upload bandwidth is measured
per GPU, a requested size is split among the GPUs by the host experts they cache, and the cache stays off with
pipeline parallelism, which keeps several micro-batches in flight. `--fit` also counts the nextn (MTP) layers, which
the loader numbers among the layers it offloads; otherwise the first layer stayed on the CPU when MTP was off.

**MTP placement.** MTP weights live in device memory ahead of every other placement rule: the nextn layers
grafted onto a model, every layer of an MTP-only GGUF passed with `--spec-draft-model` and the Gemma 4 assistant.
`llama_model_base::load_tensors` assigns their layers and the output layer to a GPU even when `n_gpu_layers`
leaves them on the CPU, and `llama_model_loader::create_tensor` ignores the overrides that send them to host
memory (`--fit` partial layers, `--cpu-moe`, `--n-cpu-moe`, `--override-tensor` and their `--spec-draft-*`
equivalents). The token embeddings stay on the CPU like those of the trunk, because a row lookup gains nothing on
the GPU. When the MTP layers do not fit in the free memory of the device with a 512 MiB margin, the regular
placement applies. `--fit` measures by loading the model without allocating it, so it sees the MTP weights on the
device and fits the rest around them; the expert cache takes what remains. With a separate MTP GGUF,
`common_model_params_to_llama` leaves the MTP layers grafted onto the target unloaded instead of keeping an unused
copy.

**Context checkpoints.** Models whose memory cannot be rolled back (recurrent or SWA layers) restore from
checkpoints. They are created at the start of a batch that starts a user, assistant or tool message (the
boundaries where agents edit the context), near the end of the prompt, and at any batch once the previous
checkpoint is `--checkpoint-min-step` tokens behind (default 1024). A message boundary only cuts a batch whose
last micro-batch is at least 3/4 full, because every extra micro-batch streams the offloaded experts again.
When `--ctx-checkpoints` is reached, the checkpoint with the closest neighbours is removed, so the remaining
ones stay spread over the context.

<a id="modules"></a>
## Module map

| module | path | responsibility | depends on | used by |
| --- | --- | --- | --- | --- |
| Build | `build/CMakeLists.txt; backend/CMakeLists.txt` | Compose the engine, server and local UI; output `mgs` while preserving upstream targets. | CMake, C/C++ toolchain | deploy/install-common.sh; build/build-local.sh |
| Native TLS | `backend/tools/server/server-tls.cpp; backend/tools/server/server-http.cpp` | Automatic or PEM certificate, default HTTPS and HTTP redirection with free ports. | OpenSSL, cpp-httplib | public executable and router |
| HTTP | `backend/tools/server/server-http.cpp` | Register prefixed APIs, authenticate requests and serve root UI assets. | cpp-httplib, llama-ui | server.cpp |
| Inference | `backend/tools/server/server-context.cpp` | Manage slots, speculative metrics and decoding; wake before token counting. | llama-common, llama, mtmd | HTTP, router |
| Router | `backend/tools/server/server-models.cpp` | Manage model children, retain API-key-file authentication at the parent and forward canonical API requests; re-execute `MGS_EXECUTABLE` when a launcher sets it. | subprocess, HTTP, streams | server.cpp |
| Streams | `backend/tools/server/server-stream.cpp` | Retain generation sessions and resume from cursors. | server-task, server-queue | chat, router |
| API documentation | `backend/tools/server/server-api-doc.cpp; frontend/api.html` | Build OpenAPI from the route registry and completion schema; embed Swagger UI. | server-schema, vendor/swagger-ui | /api/doc/ |
| Parameters and MTP | `backend/common/arg.cpp; backend/common/common.cpp` | Parse options, including `--load-mode`, and inspect GGUF before automatic MTP, including single-head glm4moe. A separate MTP GGUF leaves the MTP layers grafted onto the target unloaded. | GGUF, llama | server, model initialization |
| Model loading | `backend/src/llama-model-loader.cpp; backend/src/llama-model.cpp; backend/src/llama-mmap.cpp` | Load weights, retain/register mappings and bound Direct I/O staging to 64 MiB. MTP weights and the output layer stay in device memory and ignore the overrides to host memory. | GGML backend registration | llama-model |
| Expert prefetch | `backend/ggml/src/ggml-backend.cpp` | Overlap expert transfers with a bounded ring, synchronize input-free splits and skip empty IDs. Prefetch uploads can be served by an upload callback (expert cache); input-free splits only wait after copied inputs or a shared buffer type. | GGML devices and buffers | graph scheduler |
| Frontend | `frontend/src/routes; frontend/src/lib` | Render chat/settings; export persisted conversations and avoid repeated disabled-tools requests. | Svelte, browser storage, API | browser |
| Localization | `frontend/src/lib/i18n.ts; frontend/src/lib/locales` | Resolve JSON messages, interpolate values and persist the selected language. | four JSON catalogs | UI components and configuration |
| Deployment | `deploy/install-common.sh; deploy/configure-web.sh` | Install the binary and configure Apache plus the system service. | apt/apk, OpenSSL, systemd/OpenRC | production host |
| Debian bootstrap | `deploy/install-update-reinstall-debian.sh` | Download/synchronize sources for curl-to-Bash, lock and delegate compilation. | curl, tar, rsync, flock, install-common.sh | Local/remote Debian installation |
| Web startup | `deploy/start-web.sh; deploy/apache2.conf.in` | Select HTTP/HTTPS ports, start Apache without root, retry bind conflicts and publish live URLs. | Bash, Apache, iproute2, flock | moe-gguf-server-web |
| Project license | `LICENSE` | MIT license of the project; keeps the original llama.cpp notice (The ggml authors) and is copied into the generated bundle's licenses/ folder as `LICENSE`. | none | GitHub, build/build-local.sh |
| License notices | `build/licenses/` | Store third-party license notices and copy them into the generated bundle's licenses/ folder. | Third-party notices | build/build-local.sh |
| Local build | `build/build-local.sh; build/mgs-launcher.c` | Select local sources or download main over HTTPS, compile and assemble the relocatable installation in a private /tmp/ workspace, install it under `~/.local` (`bin/mgs`, `lib/mgs/`) by default and clean up on exit; the static launcher loads bundled libraries except the NVIDIA driver. | CMake, ldd, patchelf, static libc, CUDA Toolkit, Node.js; curl/gzip for downloads | manual workstation use, local file or curl-to-Bash |
| MoE kernels | `backend/ggml/src/ggml-{cuda,cpu,vulkan,sycl}` | Route experts, tune tiles/fusions and handle attention tails. CPU `mul_mat_id`/`add_id` skip negative expert identifiers. | GGML, device compilers | inference graphs |
| MTP execution | `backend/src/llama-{context,batch,model}.cpp; backend/src/models/glm4-moe.cpp; backend/common/{sampling,speculative,fit}.cpp` | Cache separate graph arenas, preserve row order and manage draft heads/acceptance. | llama, GGML | server slots |
| Draft metrics | `backend/tools/server/server-{context,task}.{cpp,h}` | Aggregate draft/acceptance counters, publish Prometheus metrics. | slots, task queue | /api/metrics |
| UI persistence | `frontend/src/lib/stores/{conversations,tools,agentic,settings}.svelte.ts` | Export persisted trees and retain tool availability/user settings. | IndexedDB, API | chat, settings |
| MoE expert cache | `backend/src/llama-expert-cache.{h,cpp}` | Hold recently used host experts in an LRU pool on every GPU, split small micro-batches between device and CPU, serve prefetch uploads from the pool and report its state. | GGML backends and scheduler, llama-model | llama-context, llama-graph, common, server |
| Hybrid MoE graph | `backend/src/llama-graph.cpp` | Build the expert chain once, or twice around the CPU partition for cached layers (device pool and host weights), and add both branches. | llama-expert-cache, GGML | model graphs |
| Automatic fit | `backend/common/fit.cpp` | Fit layers to device memory, keep every expert in system memory for the cache when RAM allows (spreading the layers over the GPUs by memory when there are several) and count nextn layers. | llama-ext, /proc/meminfo | common initialization |
| Context checkpoints | `backend/tools/server/server-context.cpp; backend/common/chat.h` | Create checkpoints at message boundaries and batch starts; evict the one with the closest neighbours. | message spans, llama state API | server slots |


<a id="symbols"></a>
## Key symbol index

| symbol | file:line | purpose |
| --- | --- | --- |
| `main` | [backend/tools/server/main.cpp:3](../backend/tools/server/main.cpp#L3) | CLI entry point for `mgs`. |
| `llama_server` | [backend/tools/server/server.cpp:87](../backend/tools/server/server.cpp#L87) | Initialize the process and register routes. |
| `server_http_context::init` | [backend/tools/server/server-http.cpp:144](../backend/tools/server/server-http.cpp#L144) | Configure HTTPS and HTTP redirection, validate the API prefix and install middleware. |
| `server_http_context::start` | [backend/tools/server/server-http.cpp:526](../backend/tools/server/server-http.cpp#L526) | Bind distinct ports and start both listeners. |
| `fBindServerPort` | [backend/tools/server/server-http.cpp:46](../backend/tools/server/server-http.cpp#L46) | Retry only port conflicts while keeping the selected listening socket bound. |
| `fCreateHttpsServer` | [backend/tools/server/server-tls.cpp:75](../backend/tools/server/server-tls.cpp#L75) | Load PEM certificates or generate the self-signed TLS identity in memory. |
| `server_http_context::get` | [backend/tools/server/server-http.cpp:713](../backend/tools/server/server-http.cpp#L713) | Register a GET route and record its documentation metadata. |
| `fRegisterApiDocumentation` | [backend/tools/server/server-api-doc.cpp:278](../backend/tools/server/server-api-doc.cpp#L278) | Serve the Swagger viewer, bundled assets and live OpenAPI. |
| `fCompletionProperties` | [backend/tools/server/server-api-doc.cpp:32](../backend/tools/server/server-api-doc.cpp#L32) | Expose completion parameters and descriptions from server-schema. |
| `server_model_meta::update_args` | [backend/tools/server/server-models.cpp:182](../backend/tools/server/server-models.cpp#L182) | Force explicit HTTP, a private port and the /api prefix for child processes. |
| `common_maybe_enable_embedded_mtp` | [backend/common/common.cpp:1507](../backend/common/common.cpp#L1507) | Apply automatic speculative decoding while respecting explicit options. |
| `fDetectEmbeddedMtp` | [backend/common/common.cpp:1390](../backend/common/common.cpp#L1390) | Inspect all GGUF shards for a supported complete MTP head. |
| `common_model_params_to_llama` | [backend/common/common.cpp:1897](../backend/common/common.cpp#L1897) | Convert the common parameters into model parameters; load the grafted MTP layers only when no separate MTP GGUF replaces them. |
| `llama_model_base::load_tensors` | [backend/src/llama-model.cpp:1388](../backend/src/llama-model.cpp#L1388) | Assign the layers to devices and keep the MTP layers and the output layer on a GPU when they fit. |
| `llama_model_loader::create_tensor` | [backend/src/llama-model-loader.cpp:1172](../backend/src/llama-model-loader.cpp#L1172) | Choose the buffer type of each weight, applying the overrides except those that move MTP weights to host memory. |
| `llama_mmap::register_host` | [backend/src/llama-mmap.cpp:638](../backend/src/llama-mmap.cpp#L638) | Pin mapped pages and retain their unregister callback. |
| `fInitializeExpertPrefetch` | [backend/ggml/src/ggml-backend.cpp:1651](../backend/ggml/src/ggml-backend.cpp#L1651) | Allocate/reuse expert slots with memory-pressure fallback. |
| `fApiUrl` | [frontend/src/lib/api-url.ts:8](../frontend/src/lib/api-url.ts#L8) | Resolve UI requests against the server-published API prefix. |
| `fTranslate` | [frontend/src/lib/i18n.ts:33](../frontend/src/lib/i18n.ts#L33) | Resolve a message and interpolate named values. |
| `fSetLanguage` | [frontend/src/lib/i18n.ts:40](../frontend/src/lib/i18n.ts#L40) | Persist the language in storage/URL and reload the UI. |
| `fMain (installer)` | [deploy/install-common.sh:167](../deploy/install-common.sh#L167) | Validate options, install dependencies, stage sources including build/, refresh mismatched CMake metadata and build from source/build. |
| `fInstallNccl` | [deploy/install-common.sh:116](../deploy/install-common.sh#L116) | Select NCCL for the detected CUDA release and install libnccl2/libnccl-dev at the same exact version, allowing downgrades in this APT command. |
| `fMain (Debian)` | [deploy/install-update-reinstall-debian.sh:167](../deploy/install-update-reinstall-debian.sh#L167) | Select local/remote mode and coordinate Debian installation. |
| `fDownloadSource (Debian)` | [deploy/install-update-reinstall-debian.sh:113](../deploy/install-update-reinstall-debian.sh#L113) | Validate and synchronize the source archive while retaining caches. |
| `fLockSourceDirectory (Debian)` | [deploy/install-update-reinstall-debian.sh:90](../deploy/install-update-reinstall-debian.sh#L90) | Prevent simultaneous installations using the same checkout. |
| `fRunLocalInstaller (Debian)` | [deploy/install-update-reinstall-debian.sh:149](../deploy/install-update-reinstall-debian.sh#L149) | Run the helper in another Bash with isolated functions/traps and closed stdin. |
| `fMain (web deployment)` | [deploy/configure-web.sh:37](../deploy/configure-web.sh#L37) | Create credentials, certificates, virtual hosts and service files. |
| `fMain (local build)` | [build/build-local.sh:256](../build/build-local.sh#L256) | Select local or remote sources, create the disposable /tmp/ workspace, compile from source/build, assemble the bundle, lock the output directory, copy the result and verify it. |
| `fHasProjectSources` | [build/build-local.sh:91](../build/build-local.sh#L91) | Check the required source files and license directory for local selection and downloaded archive validation. |
| `fDownloadSources` | [build/build-local.sh:102](../build/build-local.sh#L102) | Download main over HTTPS, validate archive paths, extract sources inside the private /tmp/ workspace and check the required project files. |
| `fCleanup (local build)` | [build/build-local.sh:16](../build/build-local.sh#L16) | Close and wait for the log writer, remove partial destination entries and the private /tmp/ workspace, and preserve the exit status. |
| `fBundleDependencies` | [build/build-local.sh:162](../build/build-local.sh#L162) | Copy an object's `ldd` closure into `lib/`, excluding NVIDIA driver libraries. |
| `fBundleNameServiceModules` | [build/build-local.sh:179](../build/build-local.sh#L179) | Bundle glibc NSS modules and their dependencies for host and user lookups. |
| `fPinLibrarySearchPaths` | [build/build-local.sh:191](../build/build-local.sh#L191) | Convert bundled `RUNPATH` entries to `DT_RPATH` `$ORIGIN`. |
| `fReplaceDirectory` | [build/build-local.sh:206](../build/build-local.sh#L206) | Swap a freshly assembled folder into place, restoring the previous one on failure. |
| `fVerifyBundle` | [build/build-local.sh:223](../build/build-local.sh#L223) | List dependencies through the bundled loader, as the launcher runs it, and reject libraries resolved outside `lib/`. |
| `main (launcher)` | [build/mgs-launcher.c:27](../build/mgs-launcher.c#L27) | Resolve its prefix from `bin/`, export `MGS_EXECUTABLE` and execute `lib/mgs/<loader> lib/mgs/mgs`. |
| `get_server_exec_path` | [backend/tools/server/server-models.cpp:73](../backend/tools/server/server-models.cpp#L73) | Choose the executable for router children, preferring `MGS_EXECUTABLE`. |
| `fReadOccupiedPorts` | [deploy/start-web.sh:40](../deploy/start-web.sh#L40) | Read IPv4/IPv6 listeners without stopping other services. |
| `fFindFreePort` | [deploy/start-web.sh:52](../deploy/start-web.sh#L52) | Find the next free port, excluding reserved HTTPS and rejected binds. |
| `fOwnsListener` | [deploy/start-web.sh:65](../deploy/start-web.sh#L65) | Verify that the listener belongs to the Apache child. |
| `fPublishPorts` | [deploy/start-web.sh:72](../deploy/start-web.sh#L72) | Atomically publish ports, URLs and PID after binding. |
| `fMain` | [deploy/start-web.sh:82](../deploy/start-web.sh#L82) | Supervise Apache and forward shutdown signals. |
| `ggml_backend_sched_compute_splits` | [backend/ggml/src/ggml-backend.cpp:1715](../backend/ggml/src/ggml-backend.cpp#L1715) | Synchronize splits and dispatch selective/prefetched expert copies. |
| `ggml_cuda_mul_mat_id_needs_sync` | [backend/ggml/src/ggml-cuda/ggml-cuda.cu:1869](../backend/ggml/src/ggml-cuda/ggml-cuda.cu#L1869) | Keep graph capture on asynchronous expert kernels. |
| `ggml_cuda_fattn_vec_instances` | [backend/ggml/cmake/common.cmake:53](../backend/ggml/cmake/common.cmake#L53) | Select the compiled K/V quant pairs for CUDA, HIP and MUSA. |
| `llama_context::get_gf_res_prev` | [backend/src/llama-context.cpp:2404](../backend/src/llama-context.cpp#L2404) | Select an arena by output presence and create it lazily. |
| `llama_context::output_reorder` | [backend/src/llama-context.cpp:2298](../backend/src/llama-context.cpp#L2298) | Restore original token order for unmasked NextN and layer-input rows. |
| `llama_model_glm4_moe::graph_mtp` | [backend/src/models/glm4-moe.cpp:143](../backend/src/models/glm4-moe.cpp#L143) | Build the single-head GLM MTP decoder. |
| `common_sampler_sample_and_accept_n` | [backend/common/sampling.cpp:654](../backend/common/sampling.cpp#L654) | End speculative acceptance at the first non-trailing EOG. |
| `server_routes::handle_count_tokens` | [backend/tools/server/server-context.cpp:5409](../backend/tools/server/server-context.cpp#L5409) | Use model pointers only after the response wakes the server. |
| `ConversationsStore::mGetConversationsForExport` | [frontend/src/lib/stores/conversations.svelte.ts:523](../frontend/src/lib/stores/conversations.svelte.ts#L523) | Read persisted metadata and full message trees in selected order. |
| `llama_expert_cache::fCreate` | [backend/src/llama-expert-cache.cpp:171](../backend/src/llama-expert-cache.cpp#L171) | Select host-expert GPU layers, size and allocate one pool per GPU, measure the upload bandwidth of every GPU. |
| `llama_expert_cache::mPartition` | [backend/src/llama-expert-cache.cpp:830](../backend/src/llama-expert-cache.cpp#L830) | Split a micro-batch into hits, uploads and CPU experts; queue identifiers and uploads. |
| `llama_expert_cache::mUploadWeights` | [backend/src/llama-expert-cache.cpp:693](../backend/src/llama-expert-cache.cpp#L693) | Fill a prefetch slot: cached experts device-to-device, the rest from host memory. |
| `llama_expert_cache::mFillInfo` | [backend/src/llama-expert-cache.cpp:964](../backend/src/llama-expert-cache.cpp#L964) | Report size, contents and counters. |
| `llm_graph_context::build_moe_ffn` | [backend/src/llama-graph.cpp:1794](../backend/src/llama-graph.cpp#L1794) | Build the regular expert chain or the hybrid device and CPU branches. |
| `ggml_backend_sched_set_weight_upload` | [backend/ggml/src/ggml-backend.cpp:2198](../backend/ggml/src/ggml-backend.cpp#L2198) | Install the upload callback used by the expert prefetch. |
| `llama_set_expert_cache_size` | [backend/src/llama-context.cpp:4138](../backend/src/llama-context.cpp#L4138) | Request a new cache size, applied by the next decode. |
| `llama_get_expert_cache_info` | [backend/src/llama-context.cpp:4134](../backend/src/llama-context.cpp#L4134) | Return the cache state for monitoring. |
| `fCommonMoeCacheSize` | [backend/common/common.cpp:1036](../backend/common/common.cpp#L1036) | Resolve the configured cache size from options and environment. |
| `fHostAvailableMemory` | [backend/common/fit.cpp:185](../backend/common/fit.cpp#L185) | Read the system memory available for experts kept in RAM. |
| `server_routes::post_expert_cache` | [backend/tools/server/server-context.cpp:5138](../backend/tools/server/server-context.cpp#L5138) | Validate `size_mib` and queue the cache resize. |
| `fExpertCacheJson` | [backend/tools/server/server-context.cpp:874](../backend/tools/server/server-context.cpp#L874) | Convert the cache state for `/expert-cache` and `/metrics`. |
| `create_checkpoint` | [backend/tools/server/server-context.cpp:2350](../backend/tools/server/server-context.cpp#L2350) | Store a checkpoint, evicting the one with the closest neighbours. |
| `common_chat_msg_spans::is_turn_start` | [backend/common/chat.h:176](../backend/common/chat.h#L176) | Detect user, assistant and tool message starts. |


<a id="flows"></a>
## Main call paths

1. **Installation:** Debian file/stdin entry → validation → log and lock → local checkout or GitHub `main` archive → source validation/synchronization → child Bash with closed stdin → `install-common.sh:fMain` → dependencies → stable `_/temp/source` staging including `build/` → CMake with `-S _/temp/source/build` → `bin/mgs` installation. Alpine calls the helper directly from a local checkout.
2. **Deployment:** `configure-web.sh` → service account → API key/certificate → standalone template and services → `start-web.sh` → occupied listeners → 11080+/11443+ selection → Apache bind → ownership of both listeners → `ports.json`. A real bind conflict returns to selection; other failures stop the service.
3. **Chat:** component → `ChatService` → `fApiUrl` → HTTP registration → authentication/readiness → `server_routes` → task queue/slot → llama/GGML evaluation → JSON or SSE → browser storage and rendering.
4. **Router:** external handler → canonical internal path → model selection → child `/api` request → response or retained stream. Lookup, resume and cancellation follow the same contract.
5. **MTP:** common initialization → `common_maybe_enable_embedded_mtp` → `fDetectEmbeddedMtp` → all GGUF shard headers/tensors → architecture/trunk/head checks → `draft-mtp` selection unless explicitly overridden → model load: `llama_model_base::load_tensors` places the MTP layers and the output layer on a GPU → `llama_model_loader::create_tensor` skips the overrides to host memory for them.
6. **MoE:** mapped weights → host registration → graph split → `fInitializeExpertPrefetch` → separate-backend transfer → ready/free events → computation. Memory pressure reduces the slot count or restores regular copies.
7. **Language:** storage/URL → catalog selection → `fTranslate` → Svelte-escaped text; selector → persistence → reload.
8. **Updated inference:** microbatch original indices → independent output/no-output arena → CPU/CUDA/HIP/Vulkan/SYCL kernels → restore NextN row order → accept until EOG → completed-slot speculative metrics.
9. **Export/tools:** selected IDs → persisted conversation/message read → JSONL/ZIP; tools HTTP 403 → retained disabled state → explicit panel retry.
10. **Local build:** `build/build-local.sh` from a file or stdin → options → local/remote selection → private workspace and log in `/tmp/moe-gguf-server-build.XXXXXXXX/` → toolchain, CUDA and Node.js checks → local copy or HTTPS archive download/validation/extraction into `source/`, including `build/` → CMake with `-S source/build` in `cmake/` → `llama-server` → static launcher → loader, `ldd` closure and NSS modules in `bundle/lib/mgs/` → server binary and `DT_RPATH` `$ORIGIN` → marker in `bundle/lib/mgs/` → `build/licenses/` and the root `LICENSE` in `bundle/licenses/` → prefix lock → finished artifacts copied next to their places → atomic replacement of `lib/mgs/`, `bin/mgs` and `share/doc/mgs/licenses/` → `<loader> --list` verification → `--version` through the launcher → `fCleanup` removes the private workspace. At run time: launcher → `/proc/self/exe` → `MGS_EXECUTABLE` → prefix from `bin/` → `execv(lib/mgs/<loader>, lib/mgs/mgs, arguments)` → router children re-enter through the launcher.


11. **Native web startup:** `common_params` / CLI → `server_http_context::init` → `fCreateHttpsServer` (PEM or in-memory certificate) → `start` → `fBindServerPort` for HTTPS → distinct HTTP port → two listener threads → actual URLs in the log → stop and join both threads.
12. **MoE expert cache:** first request after loading → `llama_context::decode` → `llama_expert_cache::fCreate` → eligible layers and groups → budget of every GPU → pools and identifier buffers on every GPU → bandwidth probe per GPU → `sched_reserve` with the hybrid graph and the upload callback. Micro-batches below 32 tokens: router on the device → `mPartition` on the CPU (selection copy, LRU hits, balanced uploads, identifiers) → device branch over the pool → CPU branch over host weights at the same time → `mMeasureCpu` → merge on the device → router weights. Large micro-batches: prefetch → `mUploadWeights` (device copies for cached experts, host uploads for the rest) → computation. `POST /api/expert-cache` → task queue → `llama_set_expert_cache_size` → the next decode rebuilds the cache and the graphs.
13. **Context checkpoints:** prompt batch filling → message start in a micro-batch at least 3/4 full, or last user message → batch cut → checkpoint at the batch start (message start, prompt end or `--checkpoint-min-step` since the last one) → `create_checkpoint` (evicts the closest neighbours) → a later request that diverges at position p restores the newest checkpoint before p → only the suffix is processed.

<a id="routes"></a>
## Entry points and routes

| route/URL/command | handler | file |
| --- | --- | --- |
| `mgs` | `main → llama_server` | `backend/tools/server/main.cpp` |
| `bash build/build-local.sh` | `fMain (local build)` | `build/build-local.sh` |
| `curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/build/build-local.sh` &#124; `bash -s -- [options]` | `fMain (local build) → fDownloadSources` | `build/build-local.sh` |
| `<prefix>/bin/mgs` | `main (launcher) → main → llama_server` | `build/mgs-launcher.c` |
| `/` | embedded UI assets | `backend/tools/server/server-http.cpp` |
| `/api/config.js` | runtime API prefix | `backend/tools/server/server-http.cpp` |
| `/api/doc/`, `/api/doc/openapi.json` | `fRegisterApiDocumentation` | `backend/tools/server/server-api-doc.cpp` |
| `POST /api/models` | `models_routes->post_router_models` | `backend/tools/server/server.cpp` |
| `POST /api/models/load` | `models_routes->post_router_models_load` | `backend/tools/server/server.cpp` |
| `POST /api/models/unload` | `models_routes->post_router_models_unload` | `backend/tools/server/server.cpp` |
| `GET /api/models/sse` | `models_routes->get_router_models_sse` | `backend/tools/server/server.cpp` |
| `DELETE /api/models` | `models_routes->del_router_models` | `backend/tools/server/server.cpp` |
| `GET /api/health` | `routes.get_health` | `backend/tools/server/server.cpp` |
| `GET /api/v1/health` | `routes.get_health` | `backend/tools/server/server.cpp` |
| `GET /api/metrics` | `routes.get_metrics` | `backend/tools/server/server.cpp` |
| `GET /api/props` | `routes.get_props` | `backend/tools/server/server.cpp` |
| `POST /api/props` | `routes.post_props` | `backend/tools/server/server.cpp` |
| `GET /api/models` | `routes.get_models` | `backend/tools/server/server.cpp` |
| `GET /api/v1/models` | `routes.get_models` | `backend/tools/server/server.cpp` |
| `POST /api/completions` | `routes.post_completions` | `backend/tools/server/server.cpp` |
| `POST /api/v1/completions` | `routes.post_completions_oai` | `backend/tools/server/server.cpp` |
| `POST /api/chat/completions` | `routes.post_chat_completions` | `backend/tools/server/server.cpp` |
| `POST /api/v1/chat/completions` | `routes.post_chat_completions` | `backend/tools/server/server.cpp` |
| `POST /api/v1/chat/completions/control` | `routes.post_control` | `backend/tools/server/server.cpp` |
| `POST /api/v1/responses` | `routes.post_responses_oai` | `backend/tools/server/server.cpp` |
| `POST /api/responses` | `routes.post_responses_oai` | `backend/tools/server/server.cpp` |
| `POST /api/v1/audio/transcriptions` | `routes.post_transcriptions_oai` | `backend/tools/server/server.cpp` |
| `POST /api/audio/transcriptions` | `routes.post_transcriptions_oai` | `backend/tools/server/server.cpp` |
| `POST /api/v1/messages` | `routes.post_anthropic_messages` | `backend/tools/server/server.cpp` |
| `POST /api/infill` | `routes.post_infill` | `backend/tools/server/server.cpp` |
| `POST /api/embeddings` | `routes.post_embeddings` | `backend/tools/server/server.cpp` |
| `POST /api/v1/embeddings` | `routes.post_embeddings_oai` | `backend/tools/server/server.cpp` |
| `POST /api/rerank` | `routes.post_rerank` | `backend/tools/server/server.cpp` |
| `POST /api/v1/rerank` | `routes.post_rerank` | `backend/tools/server/server.cpp` |
| `POST /api/tokenize` | `routes.post_tokenize` | `backend/tools/server/server.cpp` |
| `POST /api/detokenize` | `routes.post_detokenize` | `backend/tools/server/server.cpp` |
| `POST /api/apply-template` | `routes.post_apply_template` | `backend/tools/server/server.cpp` |
| `POST /api/chat/completions/input_tokens` | `routes.post_chat_completions_tok` | `backend/tools/server/server.cpp` |
| `POST /api/v1/chat/completions/input_tokens` | `routes.post_chat_completions_tok` | `backend/tools/server/server.cpp` |
| `POST /api/responses/input_tokens` | `routes.post_responses_tok_oai` | `backend/tools/server/server.cpp` |
| `POST /api/v1/responses/input_tokens` | `routes.post_responses_tok_oai` | `backend/tools/server/server.cpp` |
| `POST /api/v1/messages/count_tokens` | `routes.post_anthropic_count_tokens` | `backend/tools/server/server.cpp` |
| `GET /api/lora-adapters` | `routes.get_lora_adapters` | `backend/tools/server/server.cpp` |
| `POST /api/lora-adapters` | `routes.post_lora_adapters` | `backend/tools/server/server.cpp` |
| `GET /api/expert-cache` | `routes.get_expert_cache` | `backend/tools/server/server.cpp` |
| `POST /api/expert-cache` | `routes.post_expert_cache` | `backend/tools/server/server.cpp` |
| `GET /api/slots` | `routes.get_slots` | `backend/tools/server/server.cpp` |
| `POST /api/slots/:id_slot` | `routes.post_slots` | `backend/tools/server/server.cpp` |
| `GET /api/v1/stream` | `stream_get_h` | `backend/tools/server/server.cpp` |
| `POST /api/v1/streams/lookup` | `streams_lookup_h` | `backend/tools/server/server.cpp` |
| `DELETE /api/v1/stream` | `stream_delete_h` | `backend/tools/server/server.cpp` |
| `GET /api/cors-proxy` | `proxy_handler_get` | `backend/tools/server/server.cpp` |
| `POST /api/cors-proxy` | `proxy_handler_post` | `backend/tools/server/server.cpp` |
| `GET /api/tools` | `tools.handle_get` | `backend/tools/server/server.cpp` |
| `POST /api/tools` | `tools.handle_post` | `backend/tools/server/server.cpp` |
| `AIP_HEALTH_ROUTE`, `AIP_PREDICT_ROUTE` | `register_gcp_compat` | `backend/tools/server/server-http.cpp` |
| `HTTP 11080+ (executable)` | 308 redirect to selected HTTPS | `backend/tools/server/server-http.cpp` |
| `HTTPS 11443+ (executable)` | Native UI and API over TLS | `backend/tools/server/server-http.cpp; server-tls.cpp` |
| `HTTP 11080+ (Apache)` | permanent redirect to selected HTTPS | `deploy/apache2.conf.in` |
| `HTTPS 11443+ (Apache)` | ProxyPass → 127.0.0.1:8080 | `deploy/apache2.conf.in` |

<a id="impact"></a>
## Impact analysis

- **Remote installation:** URL, GitHub archive layout and entry/helper protocol changes affect `curl | bash`. Keep help options aligned and the repository origin fixed. The marker and lock protect the managed tree; do not store local edits there that must survive synchronization.
- **Native TLS:** direct clients must use HTTPS and trust the certificate or supply a known PEM pair. `--http` is explicit for the Apache backend and router children; children do not inherit public TLS variables. An explicit main port is never silently changed. Builds without OpenSSL require explicit HTTP.
- **Web ports:** affect redirects, public addresses, firewalls and the browser storage origin. `ports.json` is published only after both listeners belong to the launched Apache process. An exclusive lock prevents concurrent launchers. HTTPS is reserved before searching HTTP so overlapping sequences never share a port. Port exhaustion produces an explicit error.
- **Prefixes and middleware:** affect every HTTP client, authentication, router, streams, frontend and Swagger. Change `server-http`, `server-models`, `api-url` and their documentation together.
- **Completion schema:** affects inference validation, defaults and OpenAPI documentation. Extensions must retain protocol field names.
- **Catalogs/selector:** affect all views and labels initialized during module import. Keep keys and interpolation parameters aligned across all four catalogs. Do not translate protocol identifiers or user data.
- **Registration/prefetch:** affect RAM/VRAM use, GPU events and mapping/buffer lifetimes. Never release a registered page or slot while it remains in use.
- **MTP:** affects decoder selection before weight allocation. Preserve explicit-option precedence and inspect every GGUF shard. MTP weights ignore the overrides to host memory and take device memory before `--fit` places the trunk and before the expert cache is sized, so changing the MTP layer assignment in `load_tensors` changes the VRAM use of every model with MTP.
- **CMake/installers:** affect every build platform. Do not reuse caches from the old layout or hide local UI build failures.
- **Local bundle:** newly linked libraries are picked up automatically through `ldd`. Changes to `OUTPUT_NAME`, the router's re-execution path (`get_server_exec_path`, `MGS_EXECUTABLE`), the loader's explicit-execution mode or the library search order affect `build/build-local.sh` and the launcher. Running `lib/mgs/mgs` directly bypasses the bundled loader and is unsupported. Driver libraries must remain excluded.
- **MoE expert cache:** affects device memory (the pool takes what remains after the context; `--moe-cache-reserve` covers other processes and lazily allocated buffers), split synchronization in the scheduler, the CPU `mul_mat_id`/`add_id` kernels (negative identifiers) and the graph of every MoE architecture (`build_moe_ffn`). Device kernels for expert products must accept slot identifiers that are distinct within a token. Changing `--fit` placement changes the RAM needed: keeping every expert in RAM falls back to whole expert layers when `MemAvailable` is short. With several GPUs every GPU holds its own pool for its layers; the layer split (`--fit`, `--tensor-split`) decides which experts each GPU caches.
- **Context checkpoints:** spacing and placement affect host memory (up to `--ctx-checkpoints` states per slot) and prefill batching; every additional cut costs one more pass over the offloaded experts.
- **Removed compatibility:** clients, router presets, service overrides and build scripts must use current names; removed aliases now fail as unknown options, are ignored as environment variables or return 404 as routes. Reintroducing a name requires adding it in `common/arg.cpp`, `server.cpp` or CMake and documenting it in the CODE and MANUAL variants. Update the README only when its overview or installation command changes.

Project-specific rules prohibit writing or running tests. Review is static and does not establish runtime, GPU, remote installation or mobile overflow correctness. `tests/` is reserved without executable tests.


<a id="extensions"></a>
## Extension points

- **Endpoint:** implement its handler and register it using `get`, `post` or `del` in `server.cpp`. Registration adds the prefix and includes it in the inventory. Extend `fRouteDescription` and `fOperation` with parameters, responses and examples. Review authentication and forwarding for router operations.
- **UI text:** add a stable key to all four JSON catalogs and resolve it through `fTranslate`, using `{p0}`, `{p1}`, etc. for values. Help HTML must remain trusted; do not insert user content as unsanitized HTML.
- **CLI option:** extend `common/arg.cpp` and its parameter structure, preserve public contracts, document the behavior and update affected symbol/module/flow rows.
- **Installation:** extend `fMain` and `fShowHelp`, validate before system changes, propagate every failure and update the CODE and MANUAL variants; update the README variants if the installation command changes.
- **Local bundle:** to keep another system library out of `lib/mgs/`, extend `fIsDriverLibrary`, which also governs `fVerifyBundle`. Assemble new auxiliary files under the temporary `bundle/` directory, copy the completed artifacts next to their places in the prefix, then use `fReplaceDirectory` for directory replacement; add new installed entries to the ownership check in `fMain`.
- **Per-expert tensor:** add a role to `llama_expert_role`, map it in `fLayerExpertTensors` and in the `vTensors` bundle of `build_moe_ffn`, and pass the pool tensor to the device branch; pools, uploads and prefetch reuse then cover it.

Implementation references: [Svelte compiler](https://svelte.dev/docs/svelte/svelte-compiler), [OpenAPI servers](https://swagger.io/docs/specification/v3_0/api-host-and-base-path/) and [Apache mod_proxy](https://httpd.apache.org/docs/2.4/mod/mod_proxy.html). Swagger UI 5.30.2 is vendored in `backend/vendor/swagger-ui/` with its license notices.



[Apache Listen and restart behavior](https://httpd.apache.org/docs/2.4/bind.html)

[GitHub source archives](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives)

<a id="upstream-review"></a>
## Upstream review — 2026-10-02

Screened 1,103 upstream history entries, including August 4; 1,081 are dated August 5 through October 2, ending at **a8c9a4e7ccba** (08:18:51 UTC). Source archives/API were used without Git. The comparison snapshot **5788b510a1e3** is from August 4, 09:12 UTC; it is a reference, not a proven local fork SHA. This is a selective integration of 38 commits or their applicable parts, not a full upgrade to the upstream head. Existing public llama/GGML headers, local host registration, expert prefetch, API prefix, translations and deployment layout are preserved.

Local commit/file inventory: `_/upstream/upstream-review-2026-10-02.json` (excluded from published sources).

| Area | Applied changes | Upstream commits |
| --- | --- | --- |
| Scheduler | Input-free split synchronization, fewer artificial splits, empty expert IDs. | [#26040](https://github.com/ggml-org/llama.cpp/commit/849798132173c3c511dffe3a03c3c760d707b05f), [#28387](https://github.com/ggml-org/llama.cpp/commit/992cb503cdacf691ef06c332d05243bc7807257b), [#28739](https://github.com/ggml-org/llama.cpp/commit/43f3dda6237a453a587a8f00230d52decfeaa8e5) |
| CUDA graphs | Keep graphs for asynchronous MoE paths; separate MTP arenas with/without outputs. | [#26802](https://github.com/ggml-org/llama.cpp/commit/ebb546b7e961bd46fd9ed0387ffd14ca86b6fe1b), [#28549](https://github.com/ggml-org/llama.cpp/commit/2f3fd02526682adbd3ba771d929d271e477a35c5) |
| CUDA kernels | Fast routing for 10 selected experts; small-batch GLU/top-k fusion; fix warp races. | [#27978](https://github.com/ggml-org/llama.cpp/commit/f1793c1c4e586022efa0b1d3aa6e30ccd67f4e2d), [#27621](https://github.com/ggml-org/llama.cpp/commit/41ef91f7c8046087cdfbb276b79bff311ecf1c6d), [#28475](https://github.com/ggml-org/llama.cpp/commit/73a43d1f69345aee8bb186ef4b3172cef892f2e5) |
| CUDA tuning | Quant-dependent MMVQ/MMQ thresholds, Pascal/Volta tuning, branchless Q4_K/Q5_K and Spark L2 prefetch. | [#26079](https://github.com/ggml-org/llama.cpp/commit/2b5621094ef383cdcd8428ef6d22efe5df976532), [#26264](https://github.com/ggml-org/llama.cpp/commit/fc35562ba46fbbf8e30cac85edbb39642c37d248), [#28912](https://github.com/ggml-org/llama.cpp/commit/68d9053afd4f4d0752ced6187585f862355a40be), [#29753](https://github.com/ggml-org/llama.cpp/commit/42d958167a748f2c04b1f888e84e7a58f609ddcb), [#26705](https://github.com/ggml-org/llama.cpp/commit/73ab7599b553c03f6f5d2db24a18ad76f2eb36a3) |
| HIP / Vulkan / SYCL | Per-expert tile sizing on RDNA/Vulkan, less inactive Vulkan work and IQ MoE dispatch on SYCL. | [#28552](https://github.com/ggml-org/llama.cpp/commit/d4abd573f6a360201799072384ceec6170fdb60c), [#28935](https://github.com/ggml-org/llama.cpp/commit/fccf7166fb4c797567cf30d795828106031127b7), [#29182](https://github.com/ggml-org/llama.cpp/commit/94a0ae3e7298127b74d5b31370e83a1b4f143070), [#25483](https://github.com/ggml-org/llama.cpp/commit/7490357f22fa84fc3fd91d53fb9fc5bab0b6f9d9), [#28476](https://github.com/ggml-org/llama.cpp/commit/304665fe7ac957df95e3ff8c8c4ffdf92dd6ffa3) |
| MTP memory | Fit only loaded heads, skip fused tensors correctly, filter KV layers and isolate draft embedding settings. | [#26605](https://github.com/ggml-org/llama.cpp/commit/9a688e51e601199ad530115b9ce0bf6a7e71d75f), [#29014](https://github.com/ggml-org/llama.cpp/commit/b49650adb31f2e49a0d76113aeb1792134fd8413), [#28630](https://github.com/ggml-org/llama.cpp/commit/5cdd3d1dad5cbb7107b3e9f6d23239ba88ac0123), [#26352](https://github.com/ggml-org/llama.cpp/commit/2c6b141efb3b0868fd39d3cae73f69606e1d654c) |
| MTP correctness | Preserve batch row order, stop at EOG, skip inactive drafts and use multimodal positions. | [#29019](https://github.com/ggml-org/llama.cpp/commit/4453b535fd15cd5b9d5ccb956ebd38dc325c98fc), [#29638](https://github.com/ggml-org/llama.cpp/commit/d280808f5d82fcc3142b53f94ea5f594250cd765), [#27404](https://github.com/ggml-org/llama.cpp/commit/f466cfa38fac99e80a2aa4b58b3203b33872fe9c), [#28715](https://github.com/ggml-org/llama.cpp/commit/b0dcb8192b201e402ec3eff524e55450f8070e3e) |
| GLM-4.5-Air | Executable MTP graph and automatic detection for complete single-head glm4moe GGUFs. | [#26534](https://github.com/ggml-org/llama.cpp/commit/c060ca974c773c7c3d17fd1b66dc9d312bc292c0) |
| CPU attention | Vectorized F16 conversion and tiled attention tails with correct padded softcap masking. | [#26947](https://github.com/ggml-org/llama.cpp/commit/eeae28b67e94cbce01f016576803509dbad11d09), [#29423](https://github.com/ggml-org/llama.cpp/commit/6f767fe960c3b97cf37fac4626c86400561ca1e4) |
| Direct I/O | Limit the extra staging allocation to 64 MiB instead of duplicating a whole tensor. | [#29749](https://github.com/ggml-org/llama.cpp/commit/32dd62ee6dfa80ada846551fefec215cefc5ae1c) |
| Server | Wake safely before token counting; keep router API-key-file authentication at the parent; expose draft metrics. | [#29309](https://github.com/ggml-org/llama.cpp/commit/42916d83f4a225e56709f873aa8050ac11f5b6a4), [#28938](https://github.com/ggml-org/llama.cpp/commit/982a3329af8401772087d67c54d5948a5b270943), [#26389](https://github.com/ggml-org/llama.cpp/commit/a035a88878ad4d48c1e1b41cf83b0c11aea64bdb) |
| UI | Export persisted full conversations, stop repeated disabled-tools probes, preserve first-visit user settings. | [#27432](https://github.com/ggml-org/llama.cpp/commit/1863ac0333fdf84b66c02bed947f066fa290b316), [#28646](https://github.com/ggml-org/llama.cpp/commit/1bc7a5af0d14b1fb72f266abbd1237b394187115), [#27365](https://github.com/ggml-org/llama.cpp/commit/77acca437fb6dbe79c649ca69ff98b32bfac48c3) |
| Options | Select FA quant pairs explicitly (the deprecated alias was later removed), remove an unused peer batch option and correct load-mode advice. | [#28079](https://github.com/ggml-org/llama.cpp/commit/5a4d0fecae272c9caf0b32eb384fa6a58dddb560), [#28177](https://github.com/ggml-org/llama.cpp/commit/24f5bf8a41b29ae497a18ce82561b0d4d2a91275), [#28334](https://github.com/ggml-org/llama.cpp/commit/14a9d09f75683c94c2c4f229efe54670d4209089) |

Later adaptation (2026-10-10): the multi-GPU design of [#30112](https://github.com/ggml-org/llama.cpp/pull/30112) (merged 2026-10-08) is applied to this fork's own expert cache (`llama-expert-cache.cpp`): a pool per GPU for the layers assigned to it, a requested size split among the GPUs, per-GPU upload bandwidth and no cache with pipeline parallelism. Its code is not copied, and the upstream cache itself ([#29887](https://github.com/ggml-org/llama.cpp/pull/29887)) is not integrated: this fork keeps its own cache, which also splits every step between GPU and CPU.

The multi-token CUDA fusion intentionally covers only operations already available in this fork; it does not introduce SWIGLU_CLAMP. GLM automatic MTP still requires a complete GGUF trunk/head and exactly one head. The UI initialization refactor was unnecessary because this fork initializes persisted settings synchronously; only the user-settings preservation fix was ported.

Deferred: CPU tiled K/IQ matmul (#27851) needs the newer workspace/quant-block integration; weighted expert reduction and unconditional top-k fusion (#25952/#28432/#28422) need allocator dependencies; Metal work (#28301/#28948) needs its reorganized kernels/fusion infrastructure; OpenCL MTP dispatch (#27637) needs newer binary kernels. Row prefetch (#29599), Qwen4Exp MTP (#29761) and the broad UI rendering refactor (#28460) need larger API/model/UI migrations. The JSON inventory links each candidate and records its reason. Conversion tools, extra binaries, CI/release and tests remain outside this server-only integration.

Review covers source diffs, declarations/call sites, shared CUDA/HIP/MUSA build paths and preservation of local extensions. No build, tests, GPU benchmarks or browser runs were performed. Upstream benchmark claims are not measurements of this fork; speed and runtime correctness remain to be validated on the deployment hardware.

TLS: [OpenSSL certificate/key loading](https://docs.openssl.org/3.0/man3/SSL_CTX_use_certificate/) · [X.509 extensions](https://docs.openssl.org/3.0/man5/x509v3_config/).
