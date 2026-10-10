#include "imatrix-loader.h"
#include "common.h"
#include "log.h"
#include "gguf.h"

#include <cmath>
#include <cstring>

bool common_imatrix_load(const std::string &fname, common_imatrix &imatrix) {
  struct ggml_context *ctx = nullptr;
  struct gguf_init_params meta_gguf_params = {
      /* .no_alloc = */ false,
      /* .ctx      = */ &ctx,
  };
  struct gguf_context *ctx_gguf = gguf_init_from_file(fname.c_str(), meta_gguf_params);
  if (!ctx_gguf) {
    LOG_ERR("%s: failed to load GGUF imatrix from %s\n", __func__, fname.c_str());
    return false;
  }

  const int32_t n_entries = gguf_get_n_tensors(ctx_gguf);
  if (n_entries < 1) {
    LOG_ERR("%s: no data in file %s\n", __func__, fname.c_str());
    gguf_free(ctx_gguf);
    ggml_free(ctx);
    return false;
  }

  const int64_t datasets_key = gguf_find_key(ctx_gguf, LLM_KV_IMATRIX_DATASETS);
  const int64_t chunk_count_key = gguf_find_key(ctx_gguf, LLM_KV_IMATRIX_CHUNK_COUNT);
  const int64_t chunk_size_key = gguf_find_key(ctx_gguf, LLM_KV_IMATRIX_CHUNK_SIZE);

  if (datasets_key != -1 && gguf_get_arr_type(ctx_gguf, datasets_key) == GGUF_TYPE_STRING) {
    const int64_t n = gguf_get_arr_n(ctx_gguf, datasets_key);
    imatrix.datasets.reserve(imatrix.datasets.size() + n);
    for (int64_t i = 0; i < n; ++i) {
      imatrix.datasets.push_back(gguf_get_arr_str(ctx_gguf, datasets_key, i));
    }
  }

  imatrix.has_metadata = (datasets_key != -1 && chunk_count_key != -1 && chunk_size_key != -1);
  imatrix.chunk_count = (chunk_count_key != -1) ? gguf_get_val_u32(ctx_gguf, chunk_count_key) : 0;
  imatrix.chunk_size = (chunk_size_key != -1) ? gguf_get_val_u32(ctx_gguf, chunk_size_key) : 0;

  const std::string in_sum2_suffix{".in_sum2"};
  const std::string counts_suffix{".counts"};

  std::map<std::string, std::pair<struct ggml_tensor *, struct ggml_tensor *>> sums_counts_for;

  for (struct ggml_tensor *cur = ggml_get_first_tensor(ctx); cur; cur = ggml_get_next_tensor(ctx, cur)) {
    std::string name = cur->name;

    if (name.empty()) {
      continue;
    }

    if (string_remove_suffix(name, in_sum2_suffix)) {
      sums_counts_for[std::move(name)].first = cur;
    } else if (string_remove_suffix(name, counts_suffix)) {
      sums_counts_for[std::move(name)].second = cur;
    }
  }

  for (const auto &sc : sums_counts_for) {
    const std::string &name = sc.first;
    const struct ggml_tensor *in_sum2 = sc.second.first;
    const struct ggml_tensor *counts = sc.second.second;

    if (!in_sum2 || !counts) {
      LOG_ERR("%s: mismatched sums and counts for %s\n", __func__, name.c_str());
      gguf_free(ctx_gguf);
      ggml_free(ctx);
      return false;
    }

    auto &e = imatrix.entries[name];

    const int64_t nval = ggml_nelements(in_sum2);
    const int64_t ncounts = ggml_nelements(counts);

    e.sums.resize(nval);
    for (int64_t j = 0; j < nval; ++j) {
      e.sums[j] = ((const float *)in_sum2->data)[j];
    }

    e.counts.resize(ncounts);
    for (int64_t j = 0; j < ncounts; ++j) {
      e.counts[j] = std::lround(((const float *)counts->data)[j]);
    }
  }

  gguf_free(ctx_gguf);
  ggml_free(ctx);
  return true;
}
