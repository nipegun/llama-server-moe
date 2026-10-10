# Guía técnica

[Arquitectura y decisiones](#architecture) · [Mapa de módulos](#modules) · [Índice de símbolos clave](#symbols) · [Flujos principales](#flows) · [Entradas y rutas](#routes) · [Análisis de impacto](#impact) · [Puntos de extensión](#extensions) · [Revisión de upstream — 2026-10-02](#upstream-review)

<a id="architecture"></a>
## Arquitectura y decisiones

`frontend/` contiene la interfaz; `backend/`, el motor, servidor y dependencias;
`deploy/`, instaladores y servicios; `build/`, el script de compilación local
autónoma y su lanzador reubicable; `doc/`, documentación; y `_/`, material local. Se conservan las interfaces públicas importadas y las dependencias.

El proyecto separa la interfaz Svelte en `frontend/`, el motor y el servidor C++ en `backend/`, y la instalación en `deploy/`. El árbol interno del motor conserva sus relaciones entre `src/`, `common/`, `include/`, `ggml/`, `vendor/` y `tools/` para mantener sus targets y su API/ABI. El punto de entrada de CMake en `build/CMakeLists.txt` delega en el backend; la biblioteca de interfaz se construye desde `frontend/` y se incorpora al ejecutable. El target interno `llama-server` utiliza `OUTPUT_NAME mgs`; tanto la compilación como la instalación generan `mgs`.

El registro HTTP aplica el prefijo al publicar cada ruta. Los handlers reciben rutas internas sin prefijo, y el router añade `/api` al comunicarse con los procesos hijos. Las listas públicas de autenticación usan las rutas externas completas. La interfaz sigue en `/`; `/api/config.js` comunica el prefijo antes de cargar sus módulos. Swagger y su especificación se sirven bajo `/api/doc/`, incluso durante la carga del modelo. El inventario se obtiene del registro de métodos y rutas; los parámetros de completado proceden de `server-schema`.

Los catálogos JSON contienen todos los idiomas de la interfaz. `fTranslate` interpola parámetros sin modificar los datos de conversación. El cambio de idioma recarga la interfaz para actualizar también las etiquetas calculadas al importar los módulos. Los contratos del framework, los campos de protocolos y los símbolos importados conservan sus nombres; las funciones propias usan los prefijos de las reglas del proyecto.

La instalación exige root, registra errores explícitamente y utiliza exclusivamente `_/temp/` para trabajar. La interfaz se compila localmente; no se descarga una interfaz original que ignore los cambios. El despliegue crea servicios de inferencia y web sin root. La instancia Apache independiente busca HTTP desde 11080 y HTTPS desde 11443 en cada arranque, mientras la inferencia permanece en loopback:8080. No se configura HAProxy. Las conversaciones viven en el navegador; no hay una base de datos de usuarios del backend.

El propio servidor habilita HTTPS por defecto: `common_params` parte de 11443 y `server_http_context` reserva el primer puerto libre, seguido de HTTP desde 11080. El segundo listener devuelve 308 al HTTPS elegido, conservando host, ruta y consulta, con `Cache-Control: no-store`. `--port` fija el puerto principal (0 delega en el sistema); `--http-port` cambia el inicio de la búsqueda HTTP. Solo los conflictos de dirección ocupada permiten avanzar; otros errores detienen el arranque. `server-tls.cpp` carga la pareja PEM indicada o genera en memoria un certificado autofirmado ECDSA P-256 con SAN para localhost, loopback y el host configurado. Se genera una identidad nueva por proceso y no se invoca un comando externo. Sin soporte OpenSSL, HTTPS falla con un mensaje explícito. `--http` permite HTTP deliberado, usado por los hijos del router y por el backend de Apache en 8080; los sockets Unix y Vertex AI conservan HTTP. El destructor cierra y espera ambos listeners. Estas decisiones están en C++, con independencia del instalador o lanzador.

`build/build-local.sh` cubre el uso manual en una estación de trabajo: no necesita root, no instala paquetes ni servicios y no deja nada en ejecución. Copia un árbol de fuentes local completo o descarga el archivo de `main` desde GitHub sin Git cuando se ejecuta mediante `curl | bash` o como script suelto, compila el target `llama-server` en `/tmp/moe-gguf-server-build.XXXXXXXX/` y instala una copia autónoma y reubicable bajo un prefijo (por defecto `~/.local`, sólo para el usuario actual; `--prefix` lo cambia): `bin/mgs`, `lib/mgs/` y `share/doc/mgs/licenses/`. `lib/mgs/` contiene el binario del servidor, su cierre transitivo de `ldd`, el cargador dinámico de glibc y los módulos NSS que glibc abre con `dlopen`. El kernel solo admite un `PT_INTERP` absoluto, así que `bin/mgs` es un lanzador estático (`build/mgs-launcher.c`) que lee `/proc/self/exe`, sube de `bin/` al prefijo y ejecuta `lib/mgs/<cargador> lib/mgs/mgs` con el resto de argumentos; nada en el prefijo depende de su ubicación absoluta. El binario del servidor y las bibliotecas incluidas llevan `DT_RPATH` `$ORIGIN`, elegido a propósito porque tiene prioridad sobre `LD_LIBRARY_PATH`. Como la imagen del proceso del servidor pasa a ser el cargador, el lanzador exporta `MGS_EXECUTABLE` y `get_server_exec_path` la devuelve, así que los procesos hijos del router vuelven a entrar por el lanzador. Las bibliotecas del controlador NVIDIA (`libcuda`, `libnvidia-*`) nunca se incluyen porque tienen que coincidir con el módulo del kernel. Un archivo marcador dentro de `lib/mgs/` impide reemplazar una instalación que el script no creó.

Cada compilación local crea una carpeta privada nueva con `mktemp -d /tmp/moe-gguf-server-build.XXXXXXXX`. Allí se guardan el archivo descargado, su lista de entradas, los fuentes copiados o extraídos, la salida de CMake, las cachés de npm/Node/CUDA, los temporales, el registro y el paquete preparado en `bundle/`. La caché automática del compilador se desactiva (`GGML_CCACHE=OFF`, `CCACHE_DISABLE=1`) para que no quede ningún servidor de caché en ejecución. Con los archivos listos, el script bloquea el propio directorio del prefijo con `flock`, copia los archivos terminados a entradas temporales junto a su ubicación final y los renombra dentro del mismo sistema de archivos. `fCleanup` espera al proceso del registro y elimina la carpeta privada al terminar, ante errores y ante señales INT/TERM/HUP gestionadas. No se escriben archivos de compilación en los fuentes ni en `/opt/`; el compilador local no ofrece `--build-dir`.

La ruta del script se captura con `${BASH_SOURCE[0]:-}` antes de llamar a `fMain`, de modo que la ejecución desde stdin también funciona con `set -u`. Las opciones se procesan antes de localizar los fuentes; `--help` no necesita una copia local ni descargar fuentes. `fHasProjectSources` comprueba las entradas de compilación, el lanzador, los manifiestos del frontend y la carpeta de licencias. Una copia local completa se prepara con las exclusiones existentes. En caso contrario, `fDownloadSources` requiere curl/gzip instalados, descarga por HTTPS con reintentos, valida las rutas del archivo y extrae en la carpeta privada `source/` antes de comprobar los archivos necesarios. `fMain` se ejecuta con stdin redirigido desde `/dev/null` para que las herramientas no consuman el script recibido por la tubería. Las opciones remotas se pasan con `bash -s --`; nunca se instalan paquetes.


La entrada Debian es autónoma: detecta si dispone de un proyecto local completo o debe descargar `main` desde GitHub. El modo remoto utiliza `/opt/moe-gguf-server-source` (configurable con `LLAMA_INSTALL_SOURCE_DIR`), comprueba el marcador de origen y mantiene un bloqueo durante la sincronización y la compilación. `rsync --checksum --no-times --delete` elimina fuentes obsoletos, conserva `_/` y actualiza las fechas de los archivos cuyo contenido cambia. El helper se ejecuta en otro Bash, con stdin cerrado y sin duplicar el registro del padre.

No se mantiene ninguna capa de retrocompatibilidad. Se eliminaron los alias obsoletos de la CLI y los marcadores de opciones retiradas, los respaldos de entorno `LLAMA_ARG_NO_*`, los alias heredados de rutas HTTP (`/completion`, `/embedding`, `/reranking`), el formato de razonamiento `deepseek-legacy`, los nombres antiguos de variables CMake, las migraciones de datos del navegador y los atajos de los instaladores, de modo que cada opción, ruta, variable y dato almacenado tiene un único nombre actual. Las excepciones son deliberadas: la API y la ABI C públicas de llama/GGML/mtmd (incluidos los símbolos marcados como obsoletos), la carga de GGUF mediante respaldos de los que todavía dependen las conversiones actuales (se eliminaron los de Grok-1, MiniCPM, las primeras conversiones de GLM-4.7-Flash, el `attn_kv_b` sin dividir de Kimi-Linear, `rope.scale_linear`, las primeras conversiones de Gemma 2 y el mmproj de MiniCPM-Llama3-V 2.5), las comprobaciones de versión de toolchains y sistemas operativos, y la interoperabilidad con protocolos externos (OpenAI, Anthropic, TEI/Jina, GCP Vertex, MCP).

Para configurar manualmente desde la raíz, usá `cmake -S build -B _/temp/cmake`. Los scripts copian `build/` junto con los fuentes y seleccionan `source/build` como directorio de fuentes de CMake. Los scripts de deploy conservan los archivos generados en `_/temp/` y regeneran `CMakeCache.txt` y `CMakeFiles/` si la caché apunta a otro directorio de fuentes. La compilación local siempre usa una carpeta temporal nueva bajo `/tmp/` que se elimina al terminar.

La configuración de formato se aplica por carpetas: `.clang-format` está en `backend/`, `frontend/` y `build/`; `.editorconfig` está en esas carpetas y en `deploy/` y `tests/`. Los avisos de `build/licenses/` heredan `build/.editorconfig`. Mantené sincronizados los ajustes equivalentes. Los archivos de la raíz y de `doc/` requieren configurar el editor con UTF-8, LF e indentación de dos espacios.

La carpeta `doc/` contiene documentación de lectura. La página Swagger está en `frontend/api.html` y CMake la incorpora al servidor. El backend genera `/api/doc/openapi.json` a partir de las rutas registradas en cada solicitud; no hay un archivo fuente `openapi.json` estático.

Esta variante conserva el servidor de llama.cpp, el soporte multimodal y los
backends GGML, con optimizaciones MoE para pesos repartidos entre GPU y RAM.
El registro de memoria y la precarga de expertos derivan de
[host-register](https://github.com/thecodacus/llama.cpp/tree/fable5/host-register)
y [prefetch-experts](https://github.com/thecodacus/llama.cpp/tree/fable5/prefetch-experts).
Los slots de precarga alojan tensores de expertos gate/up/down y solapan sus
transferencias con el cálculo. MTP automático comprueba `nextn_predict_layers`,
el tronco y todos los cabezales integrados antes de elegir `draft-mtp`, incluyendo
todas las partes GGUF. El [manual](MANUAL.es-AR.md#performance) detalla los
ajustes y las limitaciones.

**Caché de expertos MoE.** `backend/src/llama-expert-cache.{h,cpp}` mantiene los expertos usados más
recientemente de cada capa cuyos expertos están en la memoria del sistema en un depósito por GPU compartido por las capas asignadas a esa GPU (una lista LRU por
grupo de capas de la misma GPU con tensores por experto de tipos y formas
idénticos). Cada hueco guarda todos los tensores de un experto: pesos, sesgos y escalas por experto, con
proyecciones gate/up separadas o combinadas. Para los micro-lotes por debajo del límite de descarga de
operaciones (32 tokens, `GGML_OP_OFFLOAD_MIN_BATCH`), `build_moe_ffn` arma dos veces la cadena de expertos: una
rama de dispositivo que lee el depósito mediante identificadores de hueco y una rama de CPU que lee los pesos
del host. Primero corre una operación de partición en la CPU (`mPartition`): cuenta los aciertos, sube una
parte de los fallos equilibrada según los anchos de banda (aproximadamente m·B_subida/(B_subida+B_cpu), al menos
uno) y encola los identificadores de hueco y las subidas en el flujo del dispositivo antes de la rama de
dispositivo; después, la rama de CPU calcula los fallos restantes al mismo tiempo. Los expertos que calcula la
otra rama reciben el identificador -1 en la CPU (los kernels de CPU `mul_mat_id`/`add_id` los omiten y escriben
ceros) y un hueco vacío en el dispositivo (la posición k usa el hueco vacío k, así ningún hueco se repite dentro
de un token, como exige el auxiliar MMQ de CUDA), por lo que la suma de ambas ramas equivale a la ejecución
normal salvo redondeo. El planificador solo sincroniza una división sin entradas con la anterior cuando esta
tenía entradas copiadas o su backend puede acceder al tipo de búfer actual; así se conserva la corrección de
upstream #26040 y ambas ramas se solapan. El ancho de banda de subida se mide al crear la caché con expertos
reales, y el de la CPU se estima durante la ejecución a partir de la duración de la rama de CPU. Los
micro-lotes grandes conservan la precarga de expertos: `ggml_backend_sched_set_weight_upload` permite que la
caché copie sus expertos dentro del dispositivo al hueco de precarga y suba desde el host solo los demás. La
caché ocupa la memoria del dispositivo que queda después del contexto, menos `--moe-cache-reserve` y los huecos
de precarga. Se crea en la primera solicitud, cuando ya se cargaron todos los contextos y proyectores (el
calentamiento común la posterga), puede cambiar de tamaño durante la ejecución (`llama_set_expert_cache_size`,
`POST /api/expert-cache`) y publica sus contadores mediante `llama_get_expert_cache_info`, `/api/expert-cache` y
`/api/metrics`. Los ajustes viajan en variables de entorno `LLAMA_MOE_CACHE*`, fijadas por las opciones
`--moe-cache*`, para no modificar la API pública. Con la caché activa y RAM
suficiente, `--fit` mantiene todos los expertos en la memoria del sistema y deja la memoria libre del dispositivo
a la caché, porque una caché LRU sirve mejor a la generación que capas de expertos estáticas completas; con varias
GPU reparte las capas sólo densas entre ellas según su memoria, para que cada GPU guarde en caché los expertos de
sus propias capas. El ancho de banda de subida se mide en cada GPU, un tamaño pedido se reparte entre las GPU
según los expertos del host que guardan, y la caché no se activa con paralelismo en cadena (pipeline
parallelism), que mantiene varios micro-lotes en curso. `--fit` también cuenta las
capas nextn (MTP), que el cargador numera entre las capas que descarga; antes, sin MTP, la primera capa quedaba
en la CPU.

**Ubicación de MTP.** Los pesos MTP viven en la memoria del dispositivo antes que cualquier otra regla de
ubicación: las capas nextn injertadas en un modelo, todas las capas de un GGUF sólo de MTP pasado con
`--spec-draft-model` y el asistente de Gemma 4. `llama_model_base::load_tensors` asigna sus capas y la capa de
salida a una GPU aunque `n_gpu_layers` las deje en la CPU, y `llama_model_loader::create_tensor` ignora las
órdenes que las envían a la memoria del sistema (capas parciales de `--fit`, `--cpu-moe`, `--n-cpu-moe`,
`--override-tensor` y sus equivalentes `--spec-draft-*`). Los embeddings de tokens siguen en la CPU, como los del
tronco, porque leer una fila no gana nada en la GPU. Si las capas MTP no caben en la memoria libre del dispositivo
con un margen de 512 MiB, se aplica la ubicación normal. `--fit` mide cargando el modelo sin reservar memoria, así
que ve los pesos MTP en el dispositivo y ajusta el resto a su alrededor; la caché de expertos ocupa lo que queda.
Con un GGUF de MTP separado, `common_model_params_to_llama` deja sin cargar las capas MTP injertadas en el modelo
principal en lugar de mantener una copia sin uso.

**Checkpoints de contexto.** Los modelos cuya memoria no se puede deshacer (capas recurrentes o SWA) se
restauran desde checkpoints. Se crean al comienzo de un lote que empieza un mensaje de usuario, asistente o
herramienta (los límites donde los agentes editan el contexto), cerca del final del prompt y en cualquier lote
cuando el checkpoint anterior quedó al menos `--checkpoint-min-step` tokens atrás (1024 por defecto). Un límite
de mensaje solo corta un lote cuyo último micro-lote está lleno al menos en sus 3/4 partes, porque cada
micro-lote adicional vuelve a transferir los expertos descargados. Al llegar a `--ctx-checkpoints`, se elimina
el checkpoint con los vecinos más próximos, así los restantes siguen repartidos por todo el contexto.

<a id="modules"></a>
## Mapa de módulos

| módulo | ruta | responsabilidad | depende de | usado por |
| --- | --- | --- | --- | --- |
| Build | `build/CMakeLists.txt; backend/CMakeLists.txt` | Configurar el motor, el servidor y la interfaz local; producir `mgs` conservando los targets originales. | CMake, C/C++ toolchain | deploy/install-common.sh; build/build-local.sh |
| TLS nativo | `backend/tools/server/server-tls.cpp; backend/tools/server/server-http.cpp` | Certificado automático o PEM, HTTPS por defecto y redirección HTTP con puertos libres. | OpenSSL, cpp-httplib | ejecutable y router públicos |
| HTTP | `backend/tools/server/server-http.cpp` | Registrar las API con prefijo, autenticar solicitudes y servir la interfaz desde la raíz. | cpp-httplib, llama-ui | server.cpp |
| Inference | `backend/tools/server/server-context.cpp` | Gestionar slots, métricas especulativas y decodificación; despertar antes de contar tokens. | llama-common, llama, mtmd | HTTP, router |
| Router | `backend/tools/server/server-models.cpp` | Gestionar los procesos hijos, autenticar api-key-file en el padre y reenviar solicitudes de API normalizadas; volver a ejecutar `MGS_EXECUTABLE` si un lanzador la define. | subprocess, HTTP, streams | server.cpp |
| Streams | `backend/tools/server/server-stream.cpp` | Conservar sesiones de generación y reanudarlas mediante cursores. | server-task, server-queue | chat, router |
| API documentation | `backend/tools/server/server-api-doc.cpp; frontend/api.html` | Crear OpenAPI desde las rutas y el esquema de completado; incorporar Swagger UI. | server-schema, vendor/swagger-ui | /api/doc/ |
| Parameters and MTP | `backend/common/arg.cpp; backend/common/common.cpp` | Interpretar las opciones, incluida `--load-mode`, e inspeccionar GGUF antes de activar MTP, incluido glm4moe con un cabezal. Un GGUF de MTP separado deja sin cargar las capas MTP injertadas en el modelo principal. | GGUF, llama | server, model initialization |
| Model loading | `backend/src/llama-model-loader.cpp; backend/src/llama-model.cpp; backend/src/llama-mmap.cpp` | Cargar pesos, mantener y registrar mapas, y limitar el buffer auxiliar de E/S directa a 64 MiB. Los pesos MTP y la capa de salida se quedan en la memoria del dispositivo e ignoran las órdenes de enviarlos a la memoria del sistema. | GGML backend registration | llama-model |
| Expert prefetch | `backend/ggml/src/ggml-backend.cpp` | Solapar transferencias con un grupo limitado de slots, sincronizar splits sin entradas y omitir IDs vacíos. Una función de subida (caché de expertos) puede servir la precarga; las divisiones sin entradas solo esperan después de entradas copiadas o un tipo de búfer compartido. | GGML devices and buffers | graph scheduler |
| Frontend | `frontend/src/routes; frontend/src/lib` | Mostrar chat y ajustes; exportar conversaciones persistidas y evitar consultas repetidas a herramientas desactivadas. | Svelte, browser storage, API | browser |
| Localization | `frontend/src/lib/i18n.ts; frontend/src/lib/locales` | Resolver textos JSON, interpolar valores y conservar el idioma elegido. | four JSON catalogs | UI components and configuration |
| Deployment | `deploy/install-common.sh; deploy/configure-web.sh` | Instalar el ejecutable y configurar Apache y el servicio del sistema. | apt/apk, OpenSSL, systemd/OpenRC | production host |
| Debian bootstrap | `deploy/install-update-reinstall-debian.sh` | Descargar y sincronizar el proyecto para `curl` a Bash; bloquear y delegar la compilación. | curl, tar, rsync, flock, install-common.sh | Instalación local/remota Debian |
| Web startup | `deploy/start-web.sh; deploy/apache2.conf.in` | Elegir puertos HTTP/HTTPS, arrancar Apache sin root, reintentar conflictos de bind y publicar las URL activas. | Bash, Apache, iproute2, flock | moe-gguf-server-web |
| Licencia del proyecto | `LICENSE` | Licencia MIT del proyecto; conserva el aviso original de llama.cpp (The ggml authors) y se copia como `LICENSE` a licenses/ en el paquete generado. | ninguno | GitHub, build/build-local.sh |
| Licencias de terceros | `build/licenses/` | Guardar avisos de licencia de terceros y copiarlos a licenses/ en el paquete generado. | Avisos de terceros | build/build-local.sh |
| Local build | `build/build-local.sh; build/mgs-launcher.c` | Elegir fuentes locales o descargar main por HTTPS, compilar y preparar la instalación reubicable en una carpeta privada de /tmp/, instalarla por defecto en `~/.local` (`bin/mgs`, `lib/mgs/`) y limpiar al salir; el lanzador estático carga las bibliotecas incluidas salvo el controlador NVIDIA. | CMake, ldd, patchelf, libc estática, CUDA Toolkit, Node.js; curl/gzip para descargas | uso manual desde archivo local o curl a Bash |
| MoE kernels | `backend/ggml/src/ggml-{cuda,cpu,vulkan,sycl}` | Enrutar expertos, ajustar tiles y fusiones, y tratar dimensiones de atención. Los kernels de CPU `mul_mat_id`/`add_id` omiten los identificadores de experto negativos. | GGML, compiladores de dispositivo | grafos de inferencia |
| MTP execution | `backend/src/llama-{context,batch,model}.cpp; backend/src/models/glm4-moe.cpp; backend/common/{sampling,speculative,fit}.cpp` | Separar arenas de grafos, conservar el orden de filas y gestionar cabezales y aceptación. | llama, GGML | slots del servidor |
| Draft metrics | `backend/tools/server/server-{context,task}.{cpp,h}` | Acumular contadores de borradores y aceptación, y publicar métricas Prometheus. | slots, cola de tareas | /api/metrics |
| UI persistence | `frontend/src/lib/stores/{conversations,tools,agentic,settings}.svelte.ts` | Exportar árboles persistidos y conservar disponibilidad de herramientas y ajustes. | IndexedDB, API | chat, ajustes |
| MoE expert cache | `backend/src/llama-expert-cache.{h,cpp}` | Mantener en un depósito LRU de cada GPU los expertos del host usados recientemente, repartir los micro-lotes chicos entre dispositivo y CPU, servir las subidas de precarga desde el depósito y publicar su estado. | GGML backends and scheduler, llama-model | llama-context, llama-graph, common, server |
| Hybrid MoE graph | `backend/src/llama-graph.cpp` | Armar la cadena de expertos una vez, o dos alrededor de la partición de CPU en las capas cacheadas (depósito del dispositivo y pesos del host), y sumar ambas ramas. | llama-expert-cache, GGML | model graphs |
| Automatic fit | `backend/common/fit.cpp` | Ajustar las capas a la memoria del dispositivo, mantener todos los expertos en la memoria del sistema para la caché cuando la RAM alcanza (repartiendo las capas entre las GPU según su memoria si hay varias) y contar las capas nextn. | llama-ext, /proc/meminfo | common initialization |
| Context checkpoints | `backend/tools/server/server-context.cpp; backend/common/chat.h` | Crear checkpoints en los límites de mensaje y al comienzo de los lotes; descartar el de vecinos más próximos. | message spans, llama state API | server slots |


<a id="symbols"></a>
## Índice de símbolos clave

| símbolo | archivo:línea | qué hace |
| --- | --- | --- |
| `main` | [backend/tools/server/main.cpp:3](../backend/tools/server/main.cpp#L3) | Entrada de la CLI `mgs`. |
| `llama_server` | [backend/tools/server/server.cpp:87](../backend/tools/server/server.cpp#L87) | Inicializar el proceso y registrar las rutas. |
| `server_http_context::init` | [backend/tools/server/server-http.cpp:144](../backend/tools/server/server-http.cpp#L144) | Configurar HTTPS y la redirección HTTP, validar el prefijo e instalar el middleware. |
| `server_http_context::start` | [backend/tools/server/server-http.cpp:526](../backend/tools/server/server-http.cpp#L526) | Reservar puertos distintos y arrancar ambas escuchas. |
| `fBindServerPort` | [backend/tools/server/server-http.cpp:46](../backend/tools/server/server-http.cpp#L46) | Reintentar solo conflictos de puerto, sin cerrar el socket reservado. |
| `fCreateHttpsServer` | [backend/tools/server/server-tls.cpp:75](../backend/tools/server/server-tls.cpp#L75) | Cargar certificados PEM o generar la identidad TLS autofirmada en memoria. |
| `server_http_context::get` | [backend/tools/server/server-http.cpp:713](../backend/tools/server/server-http.cpp#L713) | Registrar una ruta GET y su metainformación documental. |
| `fRegisterApiDocumentation` | [backend/tools/server/server-api-doc.cpp:278](../backend/tools/server/server-api-doc.cpp#L278) | Servir Swagger, sus recursos y la especificación OpenAPI. |
| `fCompletionProperties` | [backend/tools/server/server-api-doc.cpp:32](../backend/tools/server/server-api-doc.cpp#L32) | Publicar parámetros y descripciones desde server-schema. |
| `server_model_meta::update_args` | [backend/tools/server/server-models.cpp:182](../backend/tools/server/server-models.cpp#L182) | Fijar HTTP explícito, puerto privado y prefijo /api para los procesos hijos. |
| `common_maybe_enable_embedded_mtp` | [backend/common/common.cpp:1507](../backend/common/common.cpp#L1507) | Activar la decodificación especulativa respetando las opciones explícitas. |
| `fDetectEmbeddedMtp` | [backend/common/common.cpp:1390](../backend/common/common.cpp#L1390) | Inspeccionar todas las partes GGUF en busca de cabezales MTP completos. |
| `common_model_params_to_llama` | [backend/common/common.cpp:1897](../backend/common/common.cpp#L1897) | Convertir los parámetros comunes en parámetros del modelo; cargar las capas MTP injertadas sólo si ningún GGUF de MTP separado las sustituye. |
| `llama_model_base::load_tensors` | [backend/src/llama-model.cpp:1388](../backend/src/llama-model.cpp#L1388) | Asignar las capas a los dispositivos y mantener en una GPU las capas MTP y la capa de salida cuando caben. |
| `llama_model_loader::create_tensor` | [backend/src/llama-model-loader.cpp:1172](../backend/src/llama-model-loader.cpp#L1172) | Elegir el tipo de buffer de cada peso aplicando las órdenes de ubicación, salvo las que llevan pesos MTP a la memoria del sistema. |
| `llama_mmap::register_host` | [backend/src/llama-mmap.cpp:638](../backend/src/llama-mmap.cpp#L638) | Fijar páginas mapeadas y conservar la función de liberación. |
| `fInitializeExpertPrefetch` | [backend/ggml/src/ggml-backend.cpp:1651](../backend/ggml/src/ggml-backend.cpp#L1651) | Reservar o reutilizar slots y gestionar la falta de memoria. |
| `fApiUrl` | [frontend/src/lib/api-url.ts:8](../frontend/src/lib/api-url.ts#L8) | Resolver solicitudes usando el prefijo publicado por el servidor. |
| `fTranslate` | [frontend/src/lib/i18n.ts:33](../frontend/src/lib/i18n.ts#L33) | Resolver un mensaje e interpolar sus valores. |
| `fSetLanguage` | [frontend/src/lib/i18n.ts:40](../frontend/src/lib/i18n.ts#L40) | Guardar el idioma en almacenamiento/URL y recargar la interfaz. |
| `fMain (installer)` | [deploy/install-common.sh:167](../deploy/install-common.sh#L167) | Validar opciones, instalar dependencias, copiar fuentes incluyendo build/, regenerar metadatos CMake de otra ubicación y compilar desde source/build. |
| `fInstallNccl` | [deploy/install-common.sh:116](../deploy/install-common.sh#L116) | Seleccionar NCCL para la versión de CUDA detectada e instalar libnccl2/libnccl-dev con la misma versión exacta, permitiendo bajar de versión en esta orden de APT. |
| `fMain (Debian)` | [deploy/install-update-reinstall-debian.sh:167](../deploy/install-update-reinstall-debian.sh#L167) | Elegir el modo local/remoto y coordinar la instalación Debian. |
| `fDownloadSource (Debian)` | [deploy/install-update-reinstall-debian.sh:113](../deploy/install-update-reinstall-debian.sh#L113) | Validar y sincronizar el archivo de fuentes conservando las cachés. |
| `fLockSourceDirectory (Debian)` | [deploy/install-update-reinstall-debian.sh:90](../deploy/install-update-reinstall-debian.sh#L90) | Impedir instalaciones simultáneas sobre una misma copia. |
| `fRunLocalInstaller (Debian)` | [deploy/install-update-reinstall-debian.sh:149](../deploy/install-update-reinstall-debian.sh#L149) | Ejecutar el helper en otro Bash sin compartir funciones, traps ni stdin. |
| `fMain (web deployment)` | [deploy/configure-web.sh:37](../deploy/configure-web.sh#L37) | Crear credenciales, certificados, hosts virtuales y servicios. |
| `fMain (local build)` | [build/build-local.sh:256](../build/build-local.sh#L256) | Elegir fuentes locales o remotos, crear la carpeta temporal de /tmp/, compilar desde source/build, preparar el paquete, bloquear el destino, copiar el resultado y verificarlo. |
| `fHasProjectSources` | [build/build-local.sh:91](../build/build-local.sh#L91) | Comprobar los archivos de fuentes necesarios y la carpeta de licencias para elegir la copia local y validar la descarga. |
| `fDownloadSources` | [build/build-local.sh:102](../build/build-local.sh#L102) | Descargar main por HTTPS, validar las rutas del archivo, extraer los fuentes dentro de la carpeta privada de /tmp/ y comprobar los archivos necesarios. |
| `fCleanup (local build)` | [build/build-local.sh:16](../build/build-local.sh#L16) | Cerrar y esperar al proceso del registro, eliminar las entradas parciales del destino y la carpeta privada de /tmp/, y conservar el código de salida. |
| `fBundleDependencies` | [build/build-local.sh:162](../build/build-local.sh#L162) | Copiar en `lib/` el cierre `ldd` de un objeto, excluyendo las bibliotecas del controlador NVIDIA. |
| `fBundleNameServiceModules` | [build/build-local.sh:179](../build/build-local.sh#L179) | Incluir los módulos NSS de glibc y sus dependencias para resolver hosts y usuarios. |
| `fPinLibrarySearchPaths` | [build/build-local.sh:191](../build/build-local.sh#L191) | Convertir los `RUNPATH` de las bibliotecas incluidas en `DT_RPATH` `$ORIGIN`. |
| `fReplaceDirectory` | [build/build-local.sh:206](../build/build-local.sh#L206) | Colocar una carpeta recién armada y restaurar la anterior si falla. |
| `fVerifyBundle` | [build/build-local.sh:223](../build/build-local.sh#L223) | Enumerar dependencias con el cargador incluido, tal como lo ejecuta el lanzador, y rechazar bibliotecas resueltas fuera de `lib/`. |
| `main (launcher)` | [build/mgs-launcher.c:27](../build/mgs-launcher.c#L27) | Resolver su prefijo a partir de `bin/`, exportar `MGS_EXECUTABLE` y ejecutar `lib/mgs/<cargador> lib/mgs/mgs`. |
| `get_server_exec_path` | [backend/tools/server/server-models.cpp:73](../backend/tools/server/server-models.cpp#L73) | Elegir el ejecutable de los procesos hijos del router, con preferencia por `MGS_EXECUTABLE`. |
| `fReadOccupiedPorts` | [deploy/start-web.sh:40](../deploy/start-web.sh#L40) | Leer listeners IPv4/IPv6 sin detener otros servicios. |
| `fFindFreePort` | [deploy/start-web.sh:52](../deploy/start-web.sh#L52) | Buscar el primer puerto libre, excluyendo el HTTPS reservado y los bind fallidos. |
| `fOwnsListener` | [deploy/start-web.sh:65](../deploy/start-web.sh#L65) | Comprobar que el listener pertenece al Apache hijo. |
| `fPublishPorts` | [deploy/start-web.sh:72](../deploy/start-web.sh#L72) | Publicar atómicamente puertos, URL y PID después del bind. |
| `fMain` | [deploy/start-web.sh:82](../deploy/start-web.sh#L82) | Supervisar Apache y trasladar las señales de parada. |
| `ggml_backend_sched_compute_splits` | [backend/ggml/src/ggml-backend.cpp:1715](../backend/ggml/src/ggml-backend.cpp#L1715) | Sincronizar splits y ejecutar copias selectivas o precargadas de expertos. |
| `ggml_cuda_mul_mat_id_needs_sync` | [backend/ggml/src/ggml-cuda/ggml-cuda.cu:1869](../backend/ggml/src/ggml-cuda/ggml-cuda.cu#L1869) | Mantener la captura de grafos en kernels de expertos asíncronos. |
| `ggml_cuda_fattn_vec_instances` | [backend/ggml/cmake/common.cmake:53](../backend/ggml/cmake/common.cmake#L53) | Seleccionar los pares K/V compilados para CUDA, HIP y MUSA. |
| `llama_context::get_gf_res_prev` | [backend/src/llama-context.cpp:2404](../backend/src/llama-context.cpp#L2404) | Seleccionar y crear una arena según la presencia de salidas. |
| `llama_context::output_reorder` | [backend/src/llama-context.cpp:2298](../backend/src/llama-context.cpp#L2298) | Restaurar el orden original de tokens en NextN sin máscara y entradas de capas. |
| `llama_model_glm4_moe::graph_mtp` | [backend/src/models/glm4-moe.cpp:143](../backend/src/models/glm4-moe.cpp#L143) | Construir el decodificador MTP GLM con un único cabezal. |
| `common_sampler_sample_and_accept_n` | [backend/common/sampling.cpp:654](../backend/common/sampling.cpp#L654) | Detener la aceptación especulativa en el primer EOG no final. |
| `server_routes::handle_count_tokens` | [backend/tools/server/server-context.cpp:5409](../backend/tools/server/server-context.cpp#L5409) | Acceder a los punteros del modelo después de despertar el servidor. |
| `ConversationsStore::mGetConversationsForExport` | [frontend/src/lib/stores/conversations.svelte.ts:523](../frontend/src/lib/stores/conversations.svelte.ts#L523) | Leer metadatos persistidos y árboles completos de mensajes en el orden elegido. |
| `llama_expert_cache::fCreate` | [backend/src/llama-expert-cache.cpp:171](../backend/src/llama-expert-cache.cpp#L171) | Elegir las capas de GPU con expertos en el host, dimensionar y reservar un depósito por GPU y medir el ancho de banda de subida de cada GPU. |
| `llama_expert_cache::mPartition` | [backend/src/llama-expert-cache.cpp:830](../backend/src/llama-expert-cache.cpp#L830) | Repartir un micro-lote entre aciertos, subidas y expertos de CPU; encolar identificadores y subidas. |
| `llama_expert_cache::mUploadWeights` | [backend/src/llama-expert-cache.cpp:693](../backend/src/llama-expert-cache.cpp#L693) | Completar un hueco de precarga: expertos cacheados dentro del dispositivo y los demás desde el host. |
| `llama_expert_cache::mFillInfo` | [backend/src/llama-expert-cache.cpp:964](../backend/src/llama-expert-cache.cpp#L964) | Informar el tamaño, el contenido y los contadores. |
| `llm_graph_context::build_moe_ffn` | [backend/src/llama-graph.cpp:1794](../backend/src/llama-graph.cpp#L1794) | Armar la cadena de expertos normal o las ramas híbridas de dispositivo y CPU. |
| `ggml_backend_sched_set_weight_upload` | [backend/ggml/src/ggml-backend.cpp:2198](../backend/ggml/src/ggml-backend.cpp#L2198) | Instalar la función de subida que usa la precarga de expertos. |
| `llama_set_expert_cache_size` | [backend/src/llama-context.cpp:4138](../backend/src/llama-context.cpp#L4138) | Pedir un tamaño nuevo de caché, aplicado en el siguiente decode. |
| `llama_get_expert_cache_info` | [backend/src/llama-context.cpp:4134](../backend/src/llama-context.cpp#L4134) | Devolver el estado de la caché para su supervisión. |
| `fCommonMoeCacheSize` | [backend/common/common.cpp:1036](../backend/common/common.cpp#L1036) | Resolver el tamaño de caché configurado a partir de las opciones y el entorno. |
| `fHostAvailableMemory` | [backend/common/fit.cpp:185](../backend/common/fit.cpp#L185) | Leer la memoria del sistema disponible para los expertos que quedan en RAM. |
| `server_routes::post_expert_cache` | [backend/tools/server/server-context.cpp:5138](../backend/tools/server/server-context.cpp#L5138) | Validar `size_mib` y encolar el cambio de tamaño de la caché. |
| `fExpertCacheJson` | [backend/tools/server/server-context.cpp:874](../backend/tools/server/server-context.cpp#L874) | Convertir el estado de la caché para `/expert-cache` y `/metrics`. |
| `create_checkpoint` | [backend/tools/server/server-context.cpp:2350](../backend/tools/server/server-context.cpp#L2350) | Guardar un checkpoint, descartando el de vecinos más próximos. |
| `common_chat_msg_spans::is_turn_start` | [backend/common/chat.h:176](../backend/common/chat.h#L176) | Detectar el comienzo de los mensajes de usuario, asistente y herramienta. |


<a id="flows"></a>
## Flujos principales

1. **Instalación:** entrada Debian desde archivo o stdin → validación → registro y bloqueo → proyecto local o archivo GitHub `main` → validación/sincronización de fuentes → Bash hijo con stdin cerrado → `install-common.sh:fMain` → dependencias → copia estable en `_/temp/source` que incluye `build/` → CMake con `-S _/temp/source/build` → instalación de `bin/mgs`. Alpine utiliza directamente el helper desde una copia local.
2. **Despliegue:** `configure-web.sh` → cuenta del servicio → clave API/certificado → plantilla independiente y servicios → `start-web.sh` → listeners ocupados → selección 11080+/11443+ → bind de Apache → verificación de propiedad de ambos listeners → `ports.json`. Un conflicto real de bind vuelve a la selección; otros fallos detienen el servicio.
3. **Chat:** componente → `ChatService` → `fApiUrl` → registro HTTP → autenticación/estado → `server_routes` → cola/slot → evaluación llama/GGML → JSON o SSE → almacenamiento y renderizado en el navegador.
4. **Router:** handler externo → ruta interna normalizada → selección de modelo → proceso hijo en `/api` → respuesta o sesión reanudable. La búsqueda, reanudación y cancelación de flujos utilizan el mismo contrato.
5. **MTP:** inicialización común → `common_maybe_enable_embedded_mtp` → `fDetectEmbeddedMtp` → cabeceras y tensores de todas las partes → comprobación de arquitectura, tronco y cabezales → selección `draft-mtp` si no hay una elección explícita → carga del modelo: `llama_model_base::load_tensors` coloca las capas MTP y la capa de salida en una GPU → `llama_model_loader::create_tensor` ignora para ellas las órdenes de enviarlas a la memoria del sistema.
6. **MoE:** mapa de pesos → registro de host → partición del grafo → `fInitializeExpertPrefetch` → transferencia en un backend separado → eventos de disponibilidad/liberación → cálculo. Ante falta de memoria se reducen slots o se vuelve a la copia normal.
7. **Idioma:** almacenamiento/URL → selección de catálogo → `fTranslate` → texto escapado por Svelte; selector → persistencia → recarga.
8. **Inferencia actualizada:** índices originales del microlote → arena independiente con/sin salidas → kernels CPU/CUDA/HIP/Vulkan/SYCL → restauración del orden NextN → aceptación hasta EOG → métricas especulativas del slot finalizado.
9. **Exportación/herramientas:** IDs elegidos → lectura persistida de conversaciones y mensajes → JSONL/ZIP; HTTP 403 de herramientas → estado desactivado conservado → reintento al abrir el panel.
10. **Compilación local:** `build/build-local.sh` desde archivo o stdin → opciones → selección local/remota → carpeta privada y registro en `/tmp/moe-gguf-server-build.XXXXXXXX/` → comprobación de toolchain, CUDA y Node.js → copia local o descarga, validación y extracción del archivo por HTTPS en `source/`, incluido `build/` → CMake con `-S source/build` en `cmake/` → `llama-server` → lanzador estático → cargador, cierre `ldd` y módulos NSS en `bundle/lib/mgs/` → binario del servidor y `DT_RPATH` `$ORIGIN` → marcador en `bundle/lib/mgs/` → `build/licenses/` y el `LICENSE` de la raíz en `bundle/licenses/` → bloqueo del prefijo → copia de los archivos terminados junto a su ubicación final → sustitución atómica de `lib/mgs/`, `bin/mgs` y `share/doc/mgs/licenses/` → verificación con `<cargador> --list` → `--version` a través del lanzador → `fCleanup` elimina la carpeta privada. En ejecución: lanzador → `/proc/self/exe` → `MGS_EXECUTABLE` → prefijo a partir de `bin/` → `execv(lib/mgs/<cargador>, lib/mgs/mgs, argumentos)` → los procesos hijos del router vuelven a entrar por el lanzador.


11. **Arranque web nativo:** `common_params` / CLI → `server_http_context::init` → `fCreateHttpsServer` (PEM o certificado en memoria) → `start` → `fBindServerPort` para HTTPS → puerto HTTP distinto → dos hilos de escucha → URL efectivas en el registro → cierre y unión de ambos hilos.
12. **Caché de expertos MoE:** primera solicitud después de la carga → `llama_context::decode` → `llama_expert_cache::fCreate` → capas y grupos admitidos → presupuesto de cada GPU → depósitos y búferes de identificadores en cada GPU → medición de ancho de banda por GPU → `sched_reserve` con el grafo híbrido y la función de subida. Micro-lotes de menos de 32 tokens: enrutador en el dispositivo → `mPartition` en la CPU (copia de la selección, aciertos LRU, subidas equilibradas, identificadores) → rama de dispositivo sobre el depósito → rama de CPU sobre los pesos del host al mismo tiempo → `mMeasureCpu` → suma en el dispositivo → pesos del enrutador. Micro-lotes grandes: precarga → `mUploadWeights` (copias dentro del dispositivo para los expertos cacheados, subidas desde el host para el resto) → cálculo. `POST /api/expert-cache` → cola de tareas → `llama_set_expert_cache_size` → el siguiente decode reconstruye la caché y los grafos.
13. **Checkpoints de contexto:** llenado del lote del prompt → comienzo de mensaje en un micro-lote lleno al menos en 3/4, o último mensaje de usuario → corte del lote → checkpoint al comienzo del lote (comienzo de mensaje, final del prompt o `--checkpoint-min-step` desde el anterior) → `create_checkpoint` (descarta los vecinos más próximos) → una solicitud posterior que diverge en la posición p restaura el checkpoint más reciente anterior a p → solo se procesa el sufijo.

<a id="routes"></a>
## Entradas y rutas

| ruta/URL/comando | handler | archivo |
| --- | --- | --- |
| `mgs` | `main → llama_server` | `backend/tools/server/main.cpp` |
| `bash build/build-local.sh` | `fMain (local build)` | `build/build-local.sh` |
| `curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/build/build-local.sh` &#124; `bash -s -- [options]` | `fMain (local build) → fDownloadSources` | `build/build-local.sh` |
| `<prefijo>/bin/mgs` | `main (launcher) → main → llama_server` | `build/mgs-launcher.c` |
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
| `HTTP 11080+ (ejecutable)` | Redirección 308 al HTTPS seleccionado | `backend/tools/server/server-http.cpp` |
| `HTTPS 11443+ (ejecutable)` | Interfaz y API nativas con TLS | `backend/tools/server/server-http.cpp; server-tls.cpp` |
| `HTTP 11080+ (Apache)` | Redirección permanente al HTTPS seleccionado | `deploy/apache2.conf.in` |
| `HTTPS 11443+ (Apache)` | ProxyPass → 127.0.0.1:8080 | `deploy/apache2.conf.in` |

<a id="impact"></a>
## Análisis de impacto

- **Instalación remota:** cambios en la URL, el layout del archivo GitHub o el protocolo entre entrada y helper afectan a `curl | bash`. Mantener las opciones de ayuda sincronizadas y el origen fijo del repositorio. El marcador y el bloqueo protegen el árbol gestionado; no utilizarlo para modificaciones locales que deban conservarse.
- **TLS nativo:** los clientes directos deben usar HTTPS y confiar en el certificado o proporcionar una pareja PEM conocida. `--http` es explícito para el backend Apache y los hijos del router; estos no heredan las variables TLS públicas. Un puerto principal explícito no se cambia silenciosamente. Las compilaciones sin OpenSSL requieren HTTP explícito.
- **Puertos web:** afectan a redirecciones, direcciones públicas, cortafuegos y al origen del almacenamiento del navegador. `ports.json` solo se publica cuando ambos listeners pertenecen al proceso Apache lanzado. Un bloqueo exclusivo impide dos lanzadores simultáneos. El HTTPS elegido se reserva antes de buscar HTTP; si las series se solapan, no comparten puerto. Los puertos agotados producen un error explícito.
- **Prefijos y middleware:** afectan a todos los clientes HTTP, a la autenticación, al modo router, a los streams, al frontend y a Swagger. Mantener juntos `server-http`, `server-models`, `api-url` y la documentación.
- **Esquema de completado:** afecta a la validación de inferencia, los valores por defecto y la documentación OpenAPI. Las extensiones no deben renombrar campos de protocolo.
- **Catálogos/selector:** afectan a todas las pantallas y a etiquetas calculadas al iniciar. Mantener las mismas claves y parámetros en los cuatro archivos JSON; no traducir identificadores de protocolos ni datos del usuario.
- **Registro/prefetch:** afectan al uso de RAM/VRAM, a los eventos GPU y al ciclo de vida de mapas y buffers. No liberar una página registrada o un slot mientras siga en uso.
- **MTP:** afecta a la selección de decodificación antes de reservar pesos. Conservar la prioridad de opciones explícitas y comprobar todas las partes del GGUF. Los pesos MTP ignoran las órdenes de ir a la memoria del sistema y ocupan la memoria del dispositivo antes de que `--fit` coloque el tronco y de que se dimensione la caché de expertos, así que cambiar la asignación de las capas MTP en `load_tensors` cambia el uso de VRAM de todos los modelos con MTP.
- **CMake/instaladores:** afectan a todas las plataformas de compilación. No reutilizar cachés de la estructura anterior ni ocultar fallos de compilación de la interfaz.
- **Carpeta autónoma local:** las bibliotecas que se enlacen en el futuro se incluyen automáticamente mediante `ldd`. Los cambios en `OUTPUT_NAME`, en la ruta de reejecución del router (`get_server_exec_path`, `MGS_EXECUTABLE`), en el modo de ejecución explícita del cargador o en el orden de búsqueda de bibliotecas afectan a `build/build-local.sh` y al lanzador. Ejecutar directamente `lib/mgs/mgs` saltea el cargador incluido y no está soportado. Las bibliotecas del controlador tienen que seguir excluidas.
- **Caché de expertos MoE:** afecta la memoria del dispositivo (el depósito ocupa lo que queda después del contexto; `--moe-cache-reserve` cubre otros procesos y búferes reservados más tarde), la sincronización de divisiones del planificador, los kernels de CPU `mul_mat_id`/`add_id` (identificadores negativos) y el grafo de todas las arquitecturas MoE (`build_moe_ffn`). Los kernels de dispositivo para productos de expertos tienen que aceptar identificadores de hueco distintos dentro de cada token. Cambiar la ubicación de `--fit` cambia la RAM necesaria: mantener todos los expertos en RAM vuelve a capas de expertos completas cuando `MemAvailable` no alcanza. Con varias GPU cada una tiene su propio depósito para sus capas; el reparto de capas (`--fit`, `--tensor-split`) decide qué expertos guarda cada GPU.
- **Checkpoints de contexto:** la separación y la ubicación afectan la memoria del host (hasta `--ctx-checkpoints` estados por slot) y los lotes del prefill; cada corte adicional implica otra pasada por los expertos descargados.
- **Compatibilidad eliminada:** los clientes, los presets del router, las personalizaciones de servicio y los scripts de compilación tienen que usar los nombres actuales; los alias eliminados fallan como opciones desconocidas, se ignoran como variables de entorno o devuelven 404 como rutas. Recuperar un nombre exige añadirlo en `common/arg.cpp`, `server.cpp` o CMake y documentarlo en las variantes de CODE y MANUAL. El README solo cambia si se modifica su descripción general o el comando de instalación.

Las reglas específicas impiden escribir o ejecutar tests. La revisión disponible es estática; no certifica ejecución, GPU, instaladores remotos ni desbordamiento móvil. `tests/` queda reservado sin pruebas ejecutables.


<a id="extensions"></a>
## Puntos de extensión

- **Endpoint:** implementar el handler y registrarlo con `get`, `post` o `del` en `server.cpp`. El registro añade el prefijo y lo incorpora al inventario. Ampliar `fRouteDescription` y `fOperation` con parámetros, respuestas y ejemplos. Revisar autenticación y forwarding si se usa en modo router.
- **Texto de interfaz:** añadir una clave estable a los cuatro JSON, resolverla con `fTranslate` y usar parámetros `{p0}`, `{p1}`, etc. El contenido HTML de ayuda debe seguir siendo de confianza; nunca insertar mensajes de usuario como HTML sin sanitización.
- **Opción CLI:** ampliar `common/arg.cpp` y la estructura correspondiente, mantener el contrato público, documentar el efecto y actualizar las filas de símbolo, módulo y flujo afectadas.
- **Instalación:** añadir opciones a `fMain` y `fShowHelp`, validar antes de cambiar el sistema, propagar cada fallo y actualizar las variantes de CODE y MANUAL; las del README se actualizan si cambia el comando de instalación.
- **Paquete local:** para excluir otra biblioteca del sistema de `lib/mgs/`, ampliá `fIsDriverLibrary`, que también controla `fVerifyBundle`. Los archivos auxiliares nuevos se preparan en la carpeta temporal `bundle/`, se copian terminados junto a su ubicación en el prefijo y sus directorios se sustituyen con `fReplaceDirectory`; las entradas instaladas nuevas se añaden a la comprobación de propiedad en `fMain`.
- **Tensor por experto:** agregá un rol a `llama_expert_role`, asignalo en `fLayerExpertTensors` y en el grupo `vTensors` de `build_moe_ffn`, y pasá el tensor del depósito a la rama de dispositivo; los depósitos, las subidas y la reutilización en la precarga lo cubren entonces.

Referencias de implementación: [compilador Svelte](https://svelte.dev/docs/svelte/svelte-compiler), [servidores OpenAPI](https://swagger.io/docs/specification/v3_0/api-host-and-base-path/) y [Apache mod_proxy](https://httpd.apache.org/docs/2.4/mod/mod_proxy.html). Swagger UI 5.30.2 está en `backend/vendor/swagger-ui/` con sus avisos de licencia.



[Apache Listen and restart behavior](https://httpd.apache.org/docs/2.4/bind.html)

[GitHub source archives](https://docs.github.com/en/repositories/working-with-files/using-files/downloading-source-code-archives)

<a id="upstream-review"></a>
## Revisión de upstream — 2026-10-02

Se cribaron 1.103 entradas del historial, incluido el 4 de agosto; 1.081 están fechadas del 5 de agosto al 2 de octubre, hasta **a8c9a4e7ccba** (08:18:51 UTC). Se usaron archivos de fuentes y la API, sin Git. La referencia **5788b510a1e3** corresponde al 4 de agosto, 09:12 UTC; no demuestra el SHA exacto del fork local. Es una integración selectiva de 38 commits o de sus partes aplicables, no una actualización completa a la cabecera de upstream. Se conservan los encabezados públicos llama/GGML, el registro de memoria y prefetch propios, el prefijo de API, las traducciones y el despliegue.

Inventario local de commits y archivos: `_/upstream/upstream-review-2026-10-02.json` (excluido de los fuentes publicados).

| Área | Cambios aplicados | Commits de origen |
| --- | --- | --- |
| Planificador | Sincronización de splits sin entradas, menos divisiones artificiales e IDs de expertos vacíos. | [#26040](https://github.com/ggml-org/llama.cpp/commit/849798132173c3c511dffe3a03c3c760d707b05f), [#28387](https://github.com/ggml-org/llama.cpp/commit/992cb503cdacf691ef06c332d05243bc7807257b), [#28739](https://github.com/ggml-org/llama.cpp/commit/43f3dda6237a453a587a8f00230d52decfeaa8e5) |
| Grafos CUDA | Mantener grafos en rutas MoE asíncronas y separar las arenas MTP con y sin salidas. | [#26802](https://github.com/ggml-org/llama.cpp/commit/ebb546b7e961bd46fd9ed0387ffd14ca86b6fe1b), [#28549](https://github.com/ggml-org/llama.cpp/commit/2f3fd02526682adbd3ba771d929d271e477a35c5) |
| Kernels CUDA | Ruta rápida con 10 expertos activos, fusión GLU/top-k en lotes pequeños y corrección de carreras entre hilos. | [#27978](https://github.com/ggml-org/llama.cpp/commit/f1793c1c4e586022efa0b1d3aa6e30ccd67f4e2d), [#27621](https://github.com/ggml-org/llama.cpp/commit/41ef91f7c8046087cdfbb276b79bff311ecf1c6d), [#28475](https://github.com/ggml-org/llama.cpp/commit/73a43d1f69345aee8bb186ef4b3172cef892f2e5) |
| Ajustes CUDA | Umbrales MMVQ/MMQ por cuantización, ajustes Pascal/Volta, Q4_K/Q5_K sin bifurcaciones y precarga L2 en Spark. | [#26079](https://github.com/ggml-org/llama.cpp/commit/2b5621094ef383cdcd8428ef6d22efe5df976532), [#26264](https://github.com/ggml-org/llama.cpp/commit/fc35562ba46fbbf8e30cac85edbb39642c37d248), [#28912](https://github.com/ggml-org/llama.cpp/commit/68d9053afd4f4d0752ced6187585f862355a40be), [#29753](https://github.com/ggml-org/llama.cpp/commit/42d958167a748f2c04b1f888e84e7a58f609ddcb), [#26705](https://github.com/ggml-org/llama.cpp/commit/73ab7599b553c03f6f5d2db24a18ad76f2eb36a3) |
| HIP / Vulkan / SYCL | Tiles según filas por experto en RDNA/Vulkan, menos trabajo inactivo en Vulkan y ruta MoE IQ en SYCL. | [#28552](https://github.com/ggml-org/llama.cpp/commit/d4abd573f6a360201799072384ceec6170fdb60c), [#28935](https://github.com/ggml-org/llama.cpp/commit/fccf7166fb4c797567cf30d795828106031127b7), [#29182](https://github.com/ggml-org/llama.cpp/commit/94a0ae3e7298127b74d5b31370e83a1b4f143070), [#25483](https://github.com/ggml-org/llama.cpp/commit/7490357f22fa84fc3fd91d53fb9fc5bab0b6f9d9), [#28476](https://github.com/ggml-org/llama.cpp/commit/304665fe7ac957df95e3ff8c8c4ffdf92dd6ffa3) |
| Memoria MTP | Ajustar memoria a los cabezales cargados, omitir tensores fusionados correctamente, filtrar capas KV y aislar los ajustes de embeddings del borrador. | [#26605](https://github.com/ggml-org/llama.cpp/commit/9a688e51e601199ad530115b9ce0bf6a7e71d75f), [#29014](https://github.com/ggml-org/llama.cpp/commit/b49650adb31f2e49a0d76113aeb1792134fd8413), [#28630](https://github.com/ggml-org/llama.cpp/commit/5cdd3d1dad5cbb7107b3e9f6d23239ba88ac0123), [#26352](https://github.com/ggml-org/llama.cpp/commit/2c6b141efb3b0868fd39d3cae73f69606e1d654c) |
| Corrección MTP | Conservar el orden de filas del lote, detenerse en EOG, omitir borradores inactivos y usar posiciones multimodales. | [#29019](https://github.com/ggml-org/llama.cpp/commit/4453b535fd15cd5b9d5ccb956ebd38dc325c98fc), [#29638](https://github.com/ggml-org/llama.cpp/commit/d280808f5d82fcc3142b53f94ea5f594250cd765), [#27404](https://github.com/ggml-org/llama.cpp/commit/f466cfa38fac99e80a2aa4b58b3203b33872fe9c), [#28715](https://github.com/ggml-org/llama.cpp/commit/b0dcb8192b201e402ec3eff524e55450f8070e3e) |
| GLM-4.5-Air | Grafo MTP ejecutable y detección automática de GGUF glm4moe completos con un único cabezal. | [#26534](https://github.com/ggml-org/llama.cpp/commit/c060ca974c773c7c3d17fd1b66dc9d312bc292c0) |
| Atención CPU | Conversión F16 vectorizada y atención por tiles con tratamiento correcto de dimensiones y softcap del relleno. | [#26947](https://github.com/ggml-org/llama.cpp/commit/eeae28b67e94cbce01f016576803509dbad11d09), [#29423](https://github.com/ggml-org/llama.cpp/commit/6f767fe960c3b97cf37fac4626c86400561ca1e4) |
| E/S directa | Limitar el buffer auxiliar a 64 MiB en vez de duplicar un tensor completo. | [#29749](https://github.com/ggml-org/llama.cpp/commit/32dd62ee6dfa80ada846551fefec215cefc5ae1c) |
| Servidor | Despertar antes de acceder al modelo para contar tokens, autenticar api-key-file en el router y publicar métricas del borrador. | [#29309](https://github.com/ggml-org/llama.cpp/commit/42916d83f4a225e56709f873aa8050ac11f5b6a4), [#28938](https://github.com/ggml-org/llama.cpp/commit/982a3329af8401772087d67c54d5948a5b270943), [#26389](https://github.com/ggml-org/llama.cpp/commit/a035a88878ad4d48c1e1b41cf83b0c11aea64bdb) |
| Interfaz | Exportar conversaciones completas persistidas, evitar consultas repetidas a herramientas desactivadas y conservar los ajustes del usuario en la primera visita. | [#27432](https://github.com/ggml-org/llama.cpp/commit/1863ac0333fdf84b66c02bed947f066fa290b316), [#28646](https://github.com/ggml-org/llama.cpp/commit/1bc7a5af0d14b1fb72f266abbd1237b394187115), [#27365](https://github.com/ggml-org/llama.cpp/commit/77acca437fb6dbe79c649ca69ff98b32bfac48c3) |
| Opciones | Seleccionar pares de cuantización FA (el alias deprecado se retiró después), retirar una opción de peer batch sin efecto y corregir las indicaciones de load-mode. | [#28079](https://github.com/ggml-org/llama.cpp/commit/5a4d0fecae272c9caf0b32eb384fa6a58dddb560), [#28177](https://github.com/ggml-org/llama.cpp/commit/24f5bf8a41b29ae497a18ce82561b0d4d2a91275), [#28334](https://github.com/ggml-org/llama.cpp/commit/14a9d09f75683c94c2c4f229efe54670d4209089) |

Adaptación posterior (2026-10-10): el diseño para varias GPU de [#30112](https://github.com/ggml-org/llama.cpp/pull/30112) (fusionada el 2026-10-08) se aplica a la caché de expertos propia de este fork (`llama-expert-cache.cpp`): un depósito por GPU para las capas asignadas a ella, un tamaño pedido repartido entre las GPU, ancho de banda de subida por GPU y sin caché con paralelismo en cadena. No se copia su código, y la caché de llama.cpp oficial ([#29887](https://github.com/ggml-org/llama.cpp/pull/29887)) no está integrada: este fork mantiene su propia caché, que además reparte cada paso entre GPU y CPU.

La fusión CUDA para varios tokens cubre únicamente operaciones ya disponibles en este fork; no introduce SWIGLU_CLAMP. MTP automático para GLM exige un GGUF con tronco y cabezal completos, y exactamente un cabezal. No hizo falta trasladar la refactorización de inicialización de la UI porque este fork carga los ajustes persistidos sincrónicamente; se adaptó la corrección que conserva los ajustes del usuario.

Aplazados: la multiplicación CPU K/IQ por tiles (#27851) necesita la integración nueva de memoria de trabajo y bloques cuantizados; la reducción de expertos y top-k incondicional (#25952/#28432/#28422) requieren dependencias del asignador; los cambios Metal (#28301/#28948), kernels reorganizados e infraestructura de fusiones; el despacho MTP OpenCL (#27637), kernels binarios nuevos. La precarga de filas (#29599), MTP Qwen4Exp (#29761) y la refactorización amplia de renderizado (#28460) necesitan migraciones mayores de API, modelos o UI. El inventario JSON enlaza cada candidato y explica su motivo. Conversores, binarios adicionales, CI, publicaciones y tests quedan fuera de esta integración del servidor.

La revisión abarca diferencias de fuentes, declaraciones y llamadas, compilación compartida CUDA/HIP/MUSA y conservación de extensiones locales. No se ha compilado ni ejecutado tests, benchmarks GPU o navegadores. Las mediciones de upstream no son mediciones de este fork; la velocidad y el funcionamiento en ejecución siguen pendientes de validación en el hardware de despliegue.

TLS: [OpenSSL certificate/key loading](https://docs.openssl.org/3.0/man3/SSL_CTX_use_certificate/) · [X.509 extensions](https://docs.openssl.org/3.0/man5/x509v3_config/).
