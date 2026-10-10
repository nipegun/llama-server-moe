# moe-gguf-server

This README is also available in:\
[es-AR](doc/README.es-AR.md), [es-ES](doc/README.es-ES.md)

## What is it

Run GGUF Mixture of Experts (MoE) models locally through a web chat and an HTTP inference API.

This is a mixed re-implementation of llama.cpp and FreeToken, purged with nipegunian scalpel precision, to achieve the fastest inference speed possible.

## Screenshots

Screenshots have not been added yet.

## Deploy

Run it as `root`.

**Debian** (with an already installed CUDA Toolkit; the installer adjusts NCCL to match that CUDA version):

```bash
curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/deploy/install-update-reinstall-debian.sh | bash
```

## Build

Install all the dependencies first:

```bash
apt-get update
apt-get install -y build-essential cmake ninja-build patchelf libssl-dev nodejs npm curl ca-certificates
curl -fsSL -o /tmp/cuda-keyring.deb https://developer.download.nvidia.com/compute/cuda/repos/debian13/x86_64/cuda-keyring_1.1-1_all.deb
dpkg -i /tmp/cuda-keyring.deb
apt-get update
apt-get install -y cuda-toolkit libnccl2 libnccl-dev
```

Then run as your regular user, from any folder:

```bash
curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/build/build-local.sh | bash
```

- The [build dependencies](doc/MANUAL.md#local-build) must already be installed.

## Read the documentation

Explore:

- [doc/MANUAL.md](doc/MANUAL.md) to learn how to install it, set it up and use it.
- [doc/CODE.md](doc/CODE.md) to understand how it is built (for developers and for AI models).

## Sponsor this project

- **[Hire me](mailto:nipegun@gmail.com?subject=About%20the%20moe-gguf-server%20repo)** to add new features.
- **GitHub Sponsors.** You can also support the project financially on GitHub: [github.com/sponsors/nipegun](https://github.com/sponsors/nipegun).
