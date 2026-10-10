# moe-gguf-server

Este README también está disponible en:\
[en-US](../README.md), [es-AR](README.es-AR.md)

## Qué es

Ejecuta modelos GGUF Mixture of Experts (MoE) localmente mediante un chat web y una API HTTP de inferencia.

Esta es una reimplementación mixta de llama.cpp y FreeToken, depurada con precisión de bisturí nipeguniano, para lograr la mayor velocidad de inferencia posible.

## Capturas de pantalla

Todavía no se han añadido capturas de pantalla.

## Despliegue

Ejecútalo como `root`.

**Debian** (con un CUDA Toolkit ya instalado; el instalador ajusta NCCL a esa versión de CUDA):

```bash
curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/deploy/install-update-reinstall-debian.sh | bash
```

## Compilación

Instala primero todas las dependencias:

```bash
apt-get update
apt-get install -y build-essential cmake ninja-build patchelf libssl-dev nodejs npm curl ca-certificates
curl -fsSL -o /tmp/cuda-keyring.deb https://developer.download.nvidia.com/compute/cuda/repos/debian13/x86_64/cuda-keyring_1.1-1_all.deb
dpkg -i /tmp/cuda-keyring.deb
apt-get update
apt-get install -y cuda-toolkit libnccl2 libnccl-dev
```

Después, ejecútalo con tu usuario habitual, desde cualquier carpeta:

```bash
curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/build/build-local.sh | bash
```

- Las [dependencias de compilación](MANUAL.es-ES.md#local-build) deben estar ya instaladas.

## Lee la documentación

Explora:

- [doc/MANUAL.es-ES.md](MANUAL.es-ES.md) para aprender a instalarlo, configurarlo y usarlo.
- [doc/CODE.es-ES.md](CODE.es-ES.md) para entender cómo está construido (para desarrolladores y para modelos de IA).

## Patrocina este proyecto

- **[Contrátame](mailto:nipegun@gmail.com?subject=About%20the%20moe-gguf-server%20repo)** para añadir nuevas funcionalidades.
- **GitHub Sponsors.** También puedes apoyar el proyecto económicamente en GitHub: [github.com/sponsors/nipegun](https://github.com/sponsors/nipegun).
