#pragma once

// Device cache for Mixture-of-Experts weights kept in host memory.
//
// When the experts of a layer live in system RAM, every decoding step used to
// compute all of them on the CPU. The cache keeps the most recently used experts
// of every such layer in device memory, in a least-recently-used pool shared by
// all the layers of a GPU; with several GPUs, each one caches the layers assigned
// to it in its own pool. For small micro-batches each MoE block is split at run
// time: experts already in the pool, plus a bandwidth-balanced number of misses
// uploaded on the spot, run on the device while the remaining misses run on the
// CPU at the same time. Both partial results are added before the router
// weights are applied, so the output matches the regular execution.
//
// Every per-expert tensor (weights, biases and per-expert scales, merged or
// separate projections) is cached with the same slot index, which keeps the
// technique independent of the architecture and of the quantization type.

#include "ggml-backend.h"
#include "ggml.h"

#include <cstddef>
#include <cstdint>
#include <memory>
#include <unordered_map>
#include <utility>
#include <vector>

struct llama_model;
struct llama_expert_cache_info;

// Per-expert tensors that an MoE feed-forward block reads through expert identifiers.
enum llama_expert_role {
  LLAMA_EXPERT_ROLE_UP,
  LLAMA_EXPERT_ROLE_GATE,
  LLAMA_EXPERT_ROLE_GATE_UP,
  LLAMA_EXPERT_ROLE_DOWN,
  LLAMA_EXPERT_ROLE_UP_B,
  LLAMA_EXPERT_ROLE_GATE_B,
  LLAMA_EXPERT_ROLE_GATE_UP_B,
  LLAMA_EXPERT_ROLE_DOWN_B,
  LLAMA_EXPERT_ROLE_UP_S,
  LLAMA_EXPERT_ROLE_GATE_S,
  LLAMA_EXPERT_ROLE_DOWN_S,
  LLAMA_EXPERT_ROLE_COUNT,
};

struct llama_expert_tensors {
  ggml_tensor *aRoles[LLAMA_EXPERT_ROLE_COUNT] = {};

  bool mEquals(const llama_expert_tensors &pOther) const;
};

struct llama_expert_cache_layer;
struct llama_expert_cache_group;
struct llama_expert_cache_device;

class llama_expert_cache {
public:
  // Creates the cache for the layers whose experts are in host memory while the
  // rest of the layer runs on a GPU, with one pool on every GPU that runs such
  // layers. Returns nullptr when nothing qualifies, when there is not enough free
  // device memory or when the cache is disabled.
  // pRequestedMib: total size requested at run time in MiB (-1 automatic, 0 disabled),
  // split among the GPUs by the size of the host experts they cache; -2 takes
  // LLAMA_MOE_CACHE and LLAMA_MOE_CACHE_MIB from the environment.
  static std::unique_ptr<llama_expert_cache> fCreate(const llama_model &pModel,
                                                     const std::vector<ggml_backend_t> &pBackends,
                                                     int64_t pRequestedMib = -2);

  ~llama_expert_cache();

  // Hybrid execution applies to micro-batches with fewer tokens than this value,
  // the same limit below which host weights are not offloaded to the device.
  int64_t mMaxTokens() const { return vMaxTokens; }

  // Device backend that owns the pool of a cached layer.
  ggml_backend_t mBackend(const llama_expert_cache_layer *pLayer) const;

  // Size, contents and counters for monitoring.
  void mFillInfo(llama_expert_cache_info &pInfo) const;

  // Cached layer whose host tensors are exactly pTensors, or nullptr.
  llama_expert_cache_layer *mFindLayer(int pLayer, const llama_expert_tensors &pTensors, int64_t pExpertsUsed) const;

  // Pool tensors read by the device branch of a cached layer (same roles as the host tensors).
  const llama_expert_tensors &mPoolTensors(const llama_expert_cache_layer *pLayer) const;

  // CPU operation that splits the selected experts between device and CPU, uploads
  // the device identifiers and the expert fills, and returns the CPU identifiers as
  // I32 [n_expert_used, n_tokens, 2]: plane 0 holds the experts computed on the CPU
  // (-1 for the slots computed on the device) and plane 1 holds valid experts for
  // per-expert scale lookups. pInput only forces its host copy to happen here, before
  // the device branch is queued.
  ggml_tensor *mBuildPartition(ggml_context *pCtx, llama_expert_cache_layer *pLayer, ggml_tensor *pSelected,
                               ggml_tensor *pInput) const;

  // Device identifiers [n_expert_used, n_tokens] (pool slots; the first n_expert_used slots are zeros)
  // written by the partition operation of the same layer.
  ggml_tensor *mBuildDeviceIds(ggml_context *pCtx, llama_expert_cache_layer *pLayer, int64_t pExpertsUsed,
                               int64_t pTokens) const;

  // CPU operation placed after the CPU branch to measure the host expert bandwidth.
  ggml_tensor *mBuildCpuTimer(ggml_context *pCtx, llama_expert_cache_layer *pLayer, ggml_tensor *pCpuExperts) const;

  // Called by the CPU operations.
  void mPartition(llama_expert_cache_layer &pLayer, ggml_tensor *pDst);
  void mMeasureCpu(llama_expert_cache_layer &pLayer);

  // Scheduler upload callback (ggml_backend_sched_weight_upload_t) for the expert prefetch of
  // large micro-batches: cached experts are copied inside the device and only the others are
  // uploaded from host memory.
  static bool fUploadWeights(void *pUserData, ggml_backend_t pBackend, const ggml_tensor *pSrc, ggml_tensor *pDst);

private:
  llama_expert_cache() = default;

  void mTouch(llama_expert_cache_group &pGroup, int32_t pSlot);
  int32_t mFindVictim(llama_expert_cache_group &pGroup, uint64_t pStamp) const;
  void mUploadExpert(const llama_expert_cache_layer &pLayer, int32_t pExpert, int32_t pSlot);
  void mPrintStats(const char *pReason) const;
  size_t mPoolBytes() const;
  double mUploadBandwidth() const;
  bool mUploadWeights(ggml_backend_t pBackend, const ggml_tensor *pSrc, ggml_tensor *pDst);

  int64_t vMaxTokens = 32;

  std::vector<std::unique_ptr<llama_expert_cache_layer>> lLayers; // indexed by layer, nullptr when not cached
  std::vector<std::unique_ptr<llama_expert_cache_group>> lGroups;
  std::vector<std::unique_ptr<llama_expert_cache_device>> lDevices;

  std::vector<ggml_context *> lContexts;
  std::vector<ggml_backend_buffer_t> lBuffers;
  std::vector<int32_t> lHostStaging; // fallback when the device has no pinned host buffer type

  // Host tensor of every cached layer and role, for the prefetch uploads.
  std::unordered_map<const ggml_tensor *, std::pair<int, int>> dHostTensors;
  ggml_context *vViewCtx = nullptr; // scratch views of single experts for device copies

  // CPU expert evaluation bandwidth in bytes per second (each device measures its uploads).
  double vHostBandwidth = 0.0;
  double vFillRatioOverride = -1.0;

  uint64_t vStamp = 0;
  int vFirstLayer = -1;
  int64_t vStatsInterval = 0;
  uint64_t vSteps = 0;
  uint64_t vHits = 0;
  uint64_t vMisses = 0;
  uint64_t vFills = 0;
  uint64_t vCpuExperts = 0;
  uint64_t vUploadDeviceBytes = 0;
  uint64_t vUploadHostBytes = 0;
};
