# Manual de uso

[English](MANUAL.md) · [Español de Argentina](MANUAL.es-AR.md) · [Español de España](MANUAL.es-ES.md)

Índice: [instalación](#installation), [compilación local](#local-build),
[despliegue](#deployment), [chat](#chat),
[modelos y herramientas](#models), [API](#api), [rendimiento](#performance),
[compatibilidad eliminada](#removed-compatibility),
[mantenimiento](#maintenance).

<a id="installation"></a>
## Instalación y primer arranque

La instalación se realiza como root en el servidor de producción. Debian/Ubuntu
admite un script recibido directamente por la entrada estándar:

```bash
set -o pipefail
curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/deploy/install-update-reinstall-debian.sh | bash
```

No hace falta descargar primero los demás archivos. El script obtiene el archivo
de fuentes de `main` de [este repositorio](https://github.com/nipegun/moe-gguf-server/), valida que esté
completo y actualiza la copia gestionada en `/opt/moe-gguf-server-source`.
Las descargas temporales y las cachés se mantienen bajo `_/temp/` del proyecto.
La instalación inicial necesita curl y certificados CA para obtener el script;
las demás dependencias de descarga se instalan automáticamente si faltan.

Para elegir otra carpeta y pasar opciones:

```bash
curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/deploy/install-update-reinstall-debian.sh | LLAMA_INSTALL_SOURCE_DIR=/srv/moe-gguf-server-source bash -s -- --cpu --jobs 4
```

La carpeta remota debe ser absoluta y estar en un disco local. El instalador
rechaza sobrescribir una carpeta ajena: solo adopta una vacía o reutiliza una que
tenga su marcador de origen. Un bloqueo impide instalaciones simultáneas sobre
esa copia. Los siguientes usos de `curl | bash` sincronizan los fuentes, incluidos
los archivos eliminados de `main`, conservando `_/` y la caché de compilación.
La clave API, los modelos y los servicios desplegados viven fuera de esa copia
y no se modifican. Si falla una descarga o compilación, no se instala el nuevo
ejecutable; se puede repetir el mismo comando. No se necesitan operaciones Git.

Un script guardado sin sus archivos vecinos usa el mismo modo remoto. Si se
ejecuta `bash deploy/install-update-reinstall-debian.sh` desde un proyecto local
completo, instala sus fuentes actuales sin descargarlos. Las opciones después de
`bash -s --` llegan al instalador de compilación. `--help` no requiere root ni
descarga fuentes. `--no-system-deps` también impide instalar las dependencias de
descarga: curl, certificados CA, tar, gzip, rsync, util-linux y coreutils deben
estar disponibles previamente. Los procesos de instalación no consumen el script
que llega por la tubería y todo el registro utiliza `/root/webapp-install.log`.

La configuración web se realiza por separado, usando
`/opt/moe-gguf-server-source/deploy/configure-web.sh` o la ruta equivalente de
la carpeta elegida.

Alpine sigue usando una copia completa local y
`bash deploy/install-update-reinstall-alpine.sh`; necesita Bash instalado.
Debian usa CUDA y NCCL por defecto; Alpine utiliza CPU y no admite la instalación
CUDA/NCCL. `--cpu` selecciona CPU en Debian. CUDA Toolkit y los controladores GPU
deben estar instalados previamente. `--no-nccl` desactiva NCCL y
`--no-system-deps` deja la gestión de paquetes en manos del administrador.

La interfaz local necesita Node.js 20.19 o posterior en 20.x, o 22.12 o posterior.
`--no-ui` la omite. Otras opciones: `--jobs N`, `--prefix PATH`, `--build-dir PATH`,
`--cuda-architectures LIST`, `--no-openssl` y `--build-ui`.
Las variables `LLAMA_BUILD_DIR`, `LLAMA_SOURCE_STAGE_DIR`, `LLAMA_INSTALL_PREFIX`,
`LLAMA_BUILD_JOBS`, `LLAMA_BUILD_BACKEND` y `CUDACXX` permiten ajustar estos valores.
Los directorios de compilación y copia de fuentes deben ser diferentes, no pueden
contenerse entre sí y deben permanecer dentro de `_/temp/`.

El instalador añade los paquetes NCCL compatibles y el repositorio de NVIDIA
si hace falta, pero nunca instala ni actualiza CUDA Toolkit ni los controladores
GPU. Enlaza estáticamente las bibliotecas internas e instala
`/usr/local/bin/mgs`. Ningún instalador usa ni instala sudo.

En Debian/Ubuntu, `libnccl2` y `libnccl-dev` se instalan juntos con la misma versión
exacta seleccionada para la versión de CUDA detectada. Esta orden de APT usa
`--allow-downgrades` para que un paquete NCCL instalado más reciente no bloquee
la instalación de la versión seleccionada. La opción solo se pasa a la orden
de instalación de NCCL.

Si la distribución ofrece un Node.js antiguo, instalá una versión compatible
primero. La interfaz se compila localmente; los recursos precompilados originales
están desactivados por defecto porque no incluyen las traducciones ni las rutas
de API de este proyecto. Si falla la compilación de la interfaz, se detiene la
instalación.

Desde una copia local completa, elegí CPU o consultá las opciones de instalación:

```bash
bash deploy/install-update-reinstall-debian.sh --cpu
bash deploy/install-update-reinstall-debian.sh --help
```

En Alpine, instalá Bash con `apk add --no-cache bash` antes de ejecutar su instalador.

Para ejecutar un modelo:

```bash
/usr/local/bin/mgs \
  --model /ruta/al/modelo.gguf \
  --host 127.0.0.1 \
  --batch-size 2048 --ubatch-size 2048 --metrics
```

Sin `--gpu-layers`, `--n-cpu-moe` ni `--override-tensor`, el ajuste automático ubica el modelo en la
GPU y, si la memoria del sistema alcanza, mantiene los expertos MoE en la RAM para que la VRAM libre se
convierta en la [caché de expertos MoE](#expert-cache). Ajustá los tamaños de lote y los hilos (`-t`, consultá
[Hilos de CPU](#threads)) a tu hardware. En una compilación solo para CPU, omití las opciones de GPU.

Abrí la URL HTTPS mostrada al arrancar, normalmente `https://127.0.0.1:11443/`.
Un modelo grande puede tardar en cargar. La interfaz
y la documentación siguen disponibles mientras las peticiones del modelo indican
que está cargando. `--help` enumera las opciones del motor. El GGUF, la memoria GPU,
el contexto y los proyectores necesarios deben ser adecuados para la tarea.

El código del servidor activa HTTPS por defecto con cualquier método de compilación
o instalación. Reserva el primer puerto HTTPS libre desde 11443 y después uno
HTTP desde 11080, excluyendo el HTTPS elegido. HTTP responde con una redirección
permanente 308 al puerto HTTPS real, conservando el host, la ruta y los parámetros.
El registro muestra las URL elegidas; cada serie avanza de forma independiente.
`--port N` fija el puerto principal y falla si está ocupado; `--port 0` deja que
lo elija el sistema. `--http-port N` cambia el inicio de la búsqueda del puerto
de redirección. Las variables equivalentes son `LLAMA_ARG_PORT` y `LLAMA_ARG_HTTP_PORT`.

Sin archivos de certificado, el ejecutable genera un certificado autofirmado y
su clave en memoria en cada arranque, sin necesitar el comando externo `openssl`.
El navegador exige una excepción de confianza para ese certificado. Indicá juntos
`--ssl-cert-file /ruta/fullchain.pem` y `--ssl-key-file /ruta/privkey.pem` para
usar un certificado persistente en el que confíen los clientes. Una pareja
incompleta o inválida detiene el arranque. Una compilación con `--no-openssl` no
puede servir HTTPS y requiere `--http` explícito (o `LLAMA_ARG_HTTPS=false`);
HTTP sin TLS busca puerto desde 11080. Los hijos del router usan HTTP explícito
en puertos privados de loopback. Los sockets Unix y el modo Vertex AI
`AIP_MODE=PREDICTION` conservan su transporte HTTP.

La configuración de CMake está en `build/CMakeLists.txt`. Tanto los instaladores
como el script de compilación local incluyen `build/` al copiar los fuentes y lo
seleccionan automáticamente. Los instaladores regeneran la configuración de CMake
si una caché existente apunta a otro directorio de fuentes. La compilación local
siempre comienza en una carpeta nueva de `/tmp/` que se elimina al salir. Para
usar CMake directamente desde la raíz, ejecutá `cmake -S build -B _/temp/cmake`;
los comandos habituales de instalación y compilación local siguen siendo los mismos.

<a id="local-build"></a>
## Compilación local para uso manual

`build/build-local.sh` compila el proyecto en tu propia computadora e instala una
copia autónoma para tu usuario que lanzás a mano. No instala servicios, no arranca nada en
segundo plano, nunca usa root ni sudo y nunca instala paquetes. Ejecutalo con tu
usuario normal desde cualquier carpeta:

```bash
curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/build/build-local.sh | bash
```

El comando descarga el archivo de fuentes de `main` sin Git en la carpeta privada
de compilación de `/tmp`. El archivo descargado y los fuentes extraídos se eliminan
con los demás temporales al salir. Una copia suelta del script funciona igual.
Desde una copia local completa del proyecto, compilá tus fuentes locales con:

```bash
bash build/build-local.sh
```

Para pasar opciones en el comando de una línea, usá `bash -s --`; por ejemplo,
para compilar para CPU:

```bash
curl -fsSL https://raw.githubusercontent.com/nipegun/moe-gguf-server/refs/heads/main/build/build-local.sh | bash -s -- --cpu --jobs 4
```

`--help` muestra las opciones sin descargar el archivo de fuentes ni compilar.

El resultado se instala para tu usuario en el prefijo `~/.local`:

| ruta | contenido |
| --- | --- |
| `~/.local/bin/mgs` | El programa que ejecutás: un pequeño lanzador estático que localiza `../lib/mgs/` en relación con su ubicación y arranca el servidor mediante el cargador incluido. |
| `~/.local/lib/mgs/` | El binario del servidor (`mgs`, con la interfaz web y la documentación de la API incorporadas) y todas las bibliotecas compartidas que necesita: el cargador dinámico y la biblioteca C de glibc, el runtime de C++, OpenMP, OpenSSL, los módulos de resolución de nombres de glibc y, en compilaciones CUDA, el runtime de CUDA, cuBLAS y NCCL. |
| `~/.local/share/doc/mgs/licenses/` | La licencia MIT del proyecto (`LICENSE`) y los avisos de licencia de terceros copiados desde `build/licenses/` del proyecto. |

Sólo el usuario que ejecuta el script puede usar esta instalación. Todo se resuelve en relación con la ubicación del
lanzador: este ejecuta `lib/mgs/ld-linux-x86-64.so.2 lib/mgs/mgs` desde su prefijo, y el servidor y sus
bibliotecas buscan en `lib/mgs/` antes que en cualquier otro sitio, incluido `LD_LIBRARY_PATH`. La única biblioteca
que se sigue tomando del sistema es la del controlador NVIDIA (`libcuda.so.1` y las bibliotecas `libnvidia-*` que
carga), porque debe coincidir con el módulo del kernel en ejecución. Al terminar, el script enumera, mediante el
cargador incluido, las bibliotecas que cargaría el servidor, falla si alguna procede de fuera de `lib/mgs/` y ejecuta
`--version` a través del lanzador.

Debian añade `~/.local/bin` al `PATH` al iniciar sesión una vez que esa carpeta existe (mediante `~/.profile`), así
que tras volver a iniciar sesión podés ejecutar `mgs` por su nombre; el script muestra un recordatorio mientras no
esté en el `PATH`. Lanzalo cuando quieras y detenlo con Ctrl+C:

```bash
mgs --model /ruta/modelo.gguf
```

También funciona con la ruta completa: `~/.local/bin/mgs --model /ruta/modelo.gguf`.

Abrí `https://127.0.0.1:11443/` para el chat y `https://127.0.0.1:11443/api/doc/` para la
documentación de la API. Todas las opciones de este manual son válidas; por ejemplo,
`--models-dir` activa el router de varios modelos.

Requisitos, que tenés que instalar vos como root porque el script solo los
comprueba: `cmake`, un compilador C/C++ y la biblioteca C estática
(`build-essential`, que incluye `libc6-dev`), `patchelf`,
`libssl-dev` (o `--no-openssl`), Node.js 20.19+/22.12+ con npm (o `--no-ui`), un
CUDA Toolkit ya instalado (o `--cpu`) y NCCL con sus archivos de desarrollo
(`libnccl2` y `libnccl-dev`, o `--no-nccl`). `nvcc` se toma de `CUDACXX`, del
`PATH` o de `/usr/local/cuda/bin/nvcc`. Si Ninja está instalado, se usa.
Las utilidades básicas incluyen `tar`, `coreutils` y `util-linux`. La descarga de
fuentes también requiere `curl`, `ca-certificates` y `gzip`; ninguna dependencia
se instala automáticamente.

Opciones: `--prefix PATH` (otro prefijo de instalación), `--jobs N`, `--cuda`, `--cpu`,
`--cuda-architectures LIST`, `--build-ui`, `--no-ui`, `--no-openssl`, `--no-nccl`
y `--help`.

Conviene saber que:

- La compilación se optimiza para la CPU de esta computadora y para las GPU
  presentes al compilar. Recompilá en cada computadora en lugar de copiar la instalación.
- La instalación es reubicable como prefijo: mové juntos `bin/mgs` y `lib/mgs/`, conservando sus niveles
  `bin/` y `lib/`. Arrancá siempre `bin/mgs`; `lib/mgs/mgs` es interno y no debe ejecutarse directamente, porque se
  saltaría el cargador incluido.
- Repetir el script actualiza la instalación. Solo reemplaza `bin/mgs`, `lib/mgs/` y
  `share/doc/mgs/licenses/`. Una copia que ya esté en ejecución sigue funcionando; reiniciala para usar la nueva
  compilación.
- El script rechaza un prefijo en el que ya existan `bin/mgs`, `lib/mgs/` o esa carpeta de licencias si no los creó
  él; deja un marcador oculto `.moe-gguf-server-bundle` en `lib/mgs/`.
- `--prefix PATH` instala en otro prefijo en el que tu usuario pueda escribir; no puede ser `/` ni una carpeta dentro
  del proyecto.
- Los fuentes copiados, los archivos de compilación, las cachés, la instalación
  preparada y el registro usan una carpeta privada
  `/tmp/moe-gguf-server-build.XXXXXXXX/`. Tras copiar el resultado al prefijo,
  el script elimina esa carpeta. También la limpia ante errores e interrupciones
  gestionadas. Cada ejecución compila desde cero, sin escribir en los fuentes ni
  en `/opt/`. La compilación local no admite `--build-dir`.
- El prefijo se bloquea durante la copia y sustitución de los archivos terminados
  para impedir actualizaciones simultáneas de la misma instalación.
- Una compilación CUDA necesita el controlador NVIDIA para arrancar; usá `--cpu` en
  computadoras que no lo tengan.

<a id="deployment"></a>
## Despliegue en producción

Desde la carpeta de fuentes (`/opt/moe-gguf-server-source` en modo remoto),
después de instalar el ejecutable:

```bash
bash deploy/configure-web.sh --domain ia.ejemplo.com
```

El dominio debe resolver al servidor de producción. El servicio
`moe-gguf-server-web` ejecuta Apache con la cuenta `moe-gguf-server`, sin root,
en una instancia independiente. En cada arranque selecciona el primer puerto
disponible desde 11080 para HTTP y desde 11443 para HTTPS. Si están ocupados,
incrementa cada serie por separado hasta encontrar un puerto libre, sin superar
65535 ni asignar el mismo puerto a ambos protocolos. Comprueba los listeners TCP
IPv4/IPv6 y reintenta si Apache detecta que un puerto se ha ocupado entre la
selección y la apertura real. Otros errores de configuración detienen el arranque.

HTTP redirige permanentemente al HTTPS seleccionado, conservando ruta y consulta.
La redirección no se almacena en caché. Apache reenvía las peticiones a la
inferencia en `127.0.0.1:8080`, arrancada explícitamente con `--http --port 8080`,
cuyo usuario también es `moe-gguf-server`.
La instalación requiere root; ninguno de esos servicios necesita ejecutarse como
root. No se configura HAProxy ni se importan ni modifican los sitios del Apache
compartido.

Las URL efectivas se publican después de abrir ambos listeners:

```bash
cat /opt/moe-gguf-server/_/temp/web/ports.json
```

Por ejemplo, HTTP 11081 y HTTPS 11445 producen una redirección a
`https://ia.ejemplo.com:11445/`. El archivo desaparece al detenerse el servicio
y se regenera al arrancar; un reinicio puede elegir otros puertos. Cualquier
cliente, cortafuegos o proxy externo debe utilizar los valores publicados.
El puerto forma parte del [origen del navegador](https://developer.mozilla.org/en-US/docs/Glossary/Origin):
si cambia HTTPS, el historial y los ajustes locales del origen anterior siguen
separados. La exportación/importación permite trasladar las conversaciones.

La cuenta de sistema no tiene contraseña interactiva. Los modelos están en
`/opt/moe-gguf-server/models` y la clave API en `/etc/moe-gguf-server/api.key`.
Las credenciales están en `/root/webapp-credentials.txt` y el registro de
instalación en `/root/webapp-install.log`, ambos con permisos 600. La
reconfiguración conserva claves, modelos y certificados. La clave TLS tiene
permisos 640, con propietario root y grupo moe-gguf-server, para permitir
el arranque sin privilegios.

Para usar un certificado propio:

```bash
bash deploy/configure-web.sh --domain ia.ejemplo.com \
  --certificate /ruta/fullchain.pem --private-key /ruta/privkey.pem
```

Si no aportás esos archivos, se conserva el certificado existente o se crea uno
autofirmado. Configurá su confianza en el cliente o proporcioná un certificado
que ya sea de confianza. Los archivos se copian a
`/etc/moe-gguf-server/certificates/`; al renovarlos hay que actualizar las copias
y reiniciar `moe-gguf-server-web`. El script no obtiene ni renueva certificados Let's Encrypt.
Repetí el comando después de renovar los archivos originales. `--binary` permite
indicar otra ubicación del ejecutable.

El servicio funciona en modo router. Guardá GGUF legibles en
`/opt/moe-gguf-server/models` o utilizá la gestión de modelos de la interfaz.
Para opciones específicas, utilizá un override de systemd en Debian/Ubuntu o la
configuración OpenRC en Alpine. Mantené el backend en la interfaz de loopback.
El configurador web regenera su archivo de servicio al volver a ejecutarse.

Para actualizar una instalación que utilizaba el antiguo ejecutable `llama-server`,
volver a ejecutar `deploy/configure-web.sh --domain DOMINIO` después de instalar
`moe-gguf-server`, para actualizar la ruta del ejecutable en los servicios.



Para reiniciar la web y volver a buscar puertos:

```bash
systemctl restart moe-gguf-server-web
```

En Alpine: `rc-service moe-gguf-server-web restart`. Para los errores de arranque,
consultar `journalctl -u moe-gguf-server-web` en Debian o
`/var/log/moe-gguf-server-web.log` en Alpine. El diagnóstico de Apache está en
`/opt/moe-gguf-server/_/temp/web/startup.log` y `error.log`; los registros de
acceso del dominio siguen en `/var/www/DOMINIO-logs/`. La plantilla independiente
está en `/etc/moe-gguf-server/apache2.conf.in`. No se debe editar el archivo
generado dentro de `_/temp/web/`, porque se reconstruye en cada arranque.

<a id="chat"></a>
## Uso de la interfaz

1. Abrí la URL e ingresá la clave API cuando se solicite o en Ajustes → General.
2. Seleccioná un modelo. En modo router, cargá uno disponible si no hay ninguno cargado.
3. Escribí un mensaje y envialo. Enter envía y Mayús+Enter inserta un salto de línea
   de forma predeterminada; podés cambiarlo en los ajustes.
4. Adjuntá archivos. Imágenes, audio y video requieren modalidades compatibles.
   Los PDF pueden extraerse como texto o convertirse en imágenes; los modelos
   sin visión utilizan texto.
5. Podés detener la generación, omitir el razonamiento cuando sea compatible,
   editar mensajes, regenerar respuestas o bifurcar conversaciones.

La barra lateral permite buscar, fijar, renombrar, eliminar y seleccionar varias
conversaciones. Los datos y ajustes se guardan en el navegador mediante IndexedDB
y localStorage; no son una base de datos de cuentas del servidor. Exportalos
antes de borrar los datos del navegador o cambiar de perfil. Los ajustes incluyen
importación y exportación. Las exportaciones pueden contener adjuntos y, si lo
seleccionas expresamente, claves API o cabeceras de autorización MCP.

El idioma se elige en Ajustes → General. El orden es `en-GB`, `en-US`, `es-AR`,
`es-ES`; el predeterminado es `en-US`. El cambio guarda la selección y recarga la
interfaz. Guardá primero cualquier otro ajuste pendiente. El parámetro `lang`
de la URL permite elegir el idioma cuando no hay almacenamiento disponible.
Los temas son sistema, claro y oscuro. Los ajustes incluyen temperatura,
muestreadores, penalizaciones y límites de turnos del agente. Algunas funciones
dependen de opciones del servidor o del modelo seleccionado.

<a id="models"></a>
## Modelos, herramientas y MCP

El selector distingue modelos disponibles, cargados y favoritos. Los detalles
incluyen contexto, modalidades, cuantización y plantilla de chat. El modo router
mantiene procesos separados para los modelos cargados; las peticiones identifican
el modelo mediante el campo o parámetro `model`.

Configurá servidores MCP por URL y, si hace falta, cabeceras de autorización.
Podés consultar registros de conexión, instrucciones, recursos y herramientas.
El proxy CORS opcional debe activarse mediante la opción correspondiente del motor.
Se siguen aplicando las restricciones del navegador para recursos HTTP dentro
de páginas HTTPS. Las herramientas integradas del servidor y el entorno JavaScript
aislado son opcionales. La interfaz conserva las autorizaciones de herramientas
y el límite de turnos del agente.

Los flujos pueden reconectarse mediante la identidad y el cursor guardados
mientras el servidor conserve la sesión. Un servidor detenido o un flujo caducado
no garantizan la recuperación. La interfaz informa del fallo de reconexión y no
genera otra respuesta silenciosamente.

<a id="api"></a>
## API HTTP

Los ejemplos usan 11443; si se eligió otro puerto, utilizar el valor de `ports.json`.

La raíz predeterminada es `/api` y la interfaz sigue en `/`. Las rutas originales
`/v1/...` de la raíz ya no están registradas. Los clientes compatibles con OpenAI
deben usar `https://ia.ejemplo.com:11443/api/v1`. Los nombres de campos y las interfaces
C/C++ del motor mantienen su compatibilidad original.

```bash
curl https://ia.ejemplo.com:11443/api/v1/chat/completions \
  -H "Authorization: Bearer ${LLAMA_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{"model":"model-id","messages":[{"role":"user","content":"Hola"}]}'
```

Asigná la clave instalada a `LLAMA_API_KEY` en tu propia consola. Swagger está en
`/api/doc/` y su especificación en `/api/doc/openapi.json`, generada por el servidor
en cada solicitud sin un archivo JSON estático. Incluye las operaciones
nativas, embeddings, tokenización, reranking, modelos y flujos reanudables.
El inventario refleja las rutas registradas por el proceso, incluidas las del
router y las de compatibilidad opcional. Las funciones desactivadas pueden
responder con 403; una clave no válida produce 401 y un modelo cargando, 503.
Las rutas de salud y listado de modelos mantienen su acceso público.

`--api-prefix /api/personalizado` cambia el prefijo de inferencia. La interfaz
lo obtiene de `/api/config.js`; Swagger permanece en `/api/doc/`, espacio reservado
que no se puede utilizar como prefijo de inferencia. Los procesos hijos del
router usan `/api` internamente. Se rechazan los prefijos fuera de `/api/` y los
que terminan con barra.

<a id="performance"></a>
## Memoria y rendimiento

El registro de memoria de host y la precarga de expertos están activos por
defecto. La precarga solapa las transferencias con el cálculo, especialmente
con prompts grandes. El resultado depende del modelo, la capacidad de memoria
y el ancho de banda RAM/PCIe.

`--cpu-moe` o `--n-cpu-moe N` permiten mantener expertos en RAM para reducir el
uso de VRAM. El registro de memoria fija los pesos mapeados para agilizar sus
transferencias. La RAM fijada no se puede paginar; dejá memoria suficiente para
el sistema operativo. Esta ruta es específica de POSIX; Windows mantiene el
comportamiento anterior. Solo se recomienda `--load-mode none` si el registro falla
total o parcialmente.

La precarga usa tres slots de VRAM por defecto. Cada uno debe alojar el mayor
tensor de expertos transferido. Los valores 2–8 de `GGML_SCHED_PREFETCH_EXPERTS`
eligen el número de slots. Ante un fallo de reserva se conservan los que caben
si son al menos dos; de lo contrario se usan transferencias normales. Se activa
cuando el lote contiene al menos el doble de selecciones que expertos. El grupo
pertenece a la primera GPU que lo activa; las demás mantienen la copia selectiva.
Un lote mayor puede mejorar el prefill, pero también consume más memoria.

Para diagnóstico, `GGML_CUDA_REGISTER_HOST=0` desactiva el registro y
`GGML_SCHED_PREFETCH_EXPERTS=0` desactiva la precarga. No se necesitan esas
variables durante el funcionamiento normal.

MTP automático inspecciona metadatos y nombres de tensores antes de reservar
pesos, incluidas todas las partes del GGUF. Requiere arquitectura compatible,
tronco y todos los cabezales integrados; un cabezal externo no lo activa.
El máximo predeterminado es de tres tokens de borrador. `--spec-type` explícito
prevalece; `--no-spec-mtp-auto` y `--spec-type none` desactivan la selección
automática. `--spec-draft-n-max` ajusta el máximo. MTP afecta a la generación, no
directamente al prefill ni al tiempo hasta el primer token. La mejora depende
de la aceptación y del hardware; aumentar el máximo no garantiza más velocidad.

<a id="mtp-vram"></a>
Los pesos MTP se quedan siempre en la memoria de la GPU cuando caben en ella: las capas MTP injertadas en el
modelo, un GGUF de MTP separado pasado con `--spec-draft-model` y la cabeza de salida que usan. Las opciones que
llevan pesos a la memoria del sistema (`--cpu-moe`, `--n-cpu-moe`, `--override-tensor`, sus equivalentes
`--spec-draft-*` y el ajuste automático) no se les aplican, y siguen en la GPU aunque `--gpu-layers` sea bajo. El
ajuste automático coloca el resto del modelo a su alrededor y la [caché de expertos MoE](#expert-cache) usa la
memoria que queda después. Si las capas MTP no caben en la memoria libre de la GPU con un margen de 512 MiB, el
registro muestra un aviso y se colocan como cualquier otra capa. Con un GGUF de MTP separado no se cargan las capas
MTP injertadas en el modelo principal, para que no ocupen memoria dos veces; con `--spec-type none` no se carga
ningún peso MTP. El registro de carga confirma la ubicación con una línea como
`keeping the MTP weights in CUDA0 (1 layers, 856.36 MiB)`.

<a id="expert-cache"></a>
### Caché de expertos MoE

Cuando los expertos MoE están en la memoria del sistema y el resto de la capa corre en una GPU, el servidor
mantiene los expertos usados más recientemente de todas las capas en una caché que ocupa la VRAM libre; con
varias GPU, cada una guarda en su VRAM las capas que tiene asignadas. En
cada token generado (y en cualquier lote de menos de 32 tokens), los expertos que están en la caché se calculan
en la GPU, una parte de los que faltan se sube a la caché y el resto se calcula en la CPU al mismo tiempo; esa
parte se ajusta a los anchos de banda medidos de PCIe y de la CPU. Los prompts largos conservan la precarga de
expertos, que ahora copia dentro de la GPU los expertos cacheados y solo sube los demás. El resultado coincide con el de la ejecución sin caché salvo redondeo. La GPU y la CPU redondean de
forma distinta y los expertos que calcula cada una dependen del contenido de la caché, así que una generación
voraz larga puede derivar, de una ejecución a otra, hacia un texto distinto pero igual de válido tras algunos
tokens; la caché de llama.cpp oficial se comporta igual.

La caché está activa por defecto y se crea en la primera solicitud, cuando ya están cargados el modelo, el
contexto MTP y el proyector multimodal. Sin `--gpu-layers`, `--n-cpu-moe` ni `--override-tensor`, el ajuste
automático mantiene todos los expertos en la memoria del sistema si entran con margen (4 GiB o el 10 % de la
RAM) y deja la VRAM libre a la caché (con varias GPU, reparte las capas entre ellas según su memoria libre
para que todas tengan caché); si no, ubica capas de expertos completas en la GPU como antes y la caché
usa lo que queda. Las opciones explícitas de ubicación se respetan: `--cpu-moe` deja a la caché la mayor parte
de la VRAM y `--n-cpu-moe N` mantiene algunas capas fijas en la GPU. Los expertos que quedan en la RAM se fijan
en memoria, así que la RAM tiene que poder alojarlos a todos además del sistema operativo.

| Opción | Variable | Efecto |
| --- | --- | --- |
| `--moe-cache`, `--no-moe-cache` | `LLAMA_MOE_CACHE` (`0` la desactiva) | Activa o desactiva la caché (activa por defecto). |
| `--moe-cache-size MiB` | `LLAMA_MOE_CACHE_MIB` | Tamaño total fijo de la caché, repartido entre las GPU según los expertos que guarda cada una; `-1` (por defecto) usa la VRAM libre de cada GPU. |
| `--moe-cache-reserve MiB` | `LLAMA_MOE_CACHE_RESERVE_MIB` | VRAM que se deja libre en cada GPU además de la caché y de los huecos de precarga (1024 por defecto). Aumentala si otros programas usan la GPU. |
| — | `LLAMA_MOE_CACHE_FILL_RATIO` | Diagnóstico: proporción fija (0–1) de expertos que faltan y se suben, en lugar del equilibrio medido. |
| — | `LLAMA_MOE_CACHE_STATS` | Diagnóstico: registra los contadores de la caché cada N pasos de generación (visibles con `-lv 4`). |

`GET /api/expert-cache` devuelve el tamaño, las capas y huecos cacheados, los aciertos y fallos, las subidas,
los expertos calculados en la CPU, la proporción de bytes de precarga servidos desde la caché y los anchos de banda medidos (con varias GPU, los
tamaños y contadores se suman y el ancho de banda de subida es su media). `POST /api/expert-cache` con `{"size_mib": N}` cambia el tamaño sin reiniciar (`-1` automático,
`0` libera la caché); la siguiente solicitud lo aplica y arranca con la caché vacía:

```bash
curl -H "Authorization: Bearer ${LLAMA_API_KEY}" https://127.0.0.1:11443/api/expert-cache
curl -H "Authorization: Bearer ${LLAMA_API_KEY}" -H 'Content-Type: application/json' \
  -d '{"size_mib": 2048}' https://127.0.0.1:11443/api/expert-cache
```

Con `--metrics`, `/api/metrics` agrega contadores e indicadores `llamacpp:moe_cache_*` (pasos, aciertos, fallos,
subidas, expertos en CPU, bytes de precarga, tamaño, huecos y anchos de banda).

Medición de referencia en una RTX 4060 Ti de 16 GB con Qwen3.6-35B-A3B Q8_0 (35 GiB, 8 hilos de CPU), frente a
`--n-cpu-moe 28` sin caché: generación de 26,9 a 35,7 tokens/s (+33 %), procesamiento del prompt de 767–778 a
718–730 tokens/s (−6 %) y, con MTP activo, de 33,6 a 47,0 tokens/s (+40 %). En la misma máquina, llama.cpp oficial
con su propia caché (`-cmoe --moe-cache-mib 10240`) llegó a 26,7 tokens/s, y a 27,8 con MTP. La ganancia depende de la parte de
los expertos que entra en la VRAM, de la localidad del enrutado del modelo y de los anchos de banda de PCIe y de
la RAM.

<a id="threads"></a>
### Hilos de CPU

La CPU calcula los expertos que no están en la caché, y cada operación espera a su hilo más lento. En máquinas
virtuales, o cuando otros programas comparten la CPU, usar menos hilos que núcleos puede ser mucho más rápido:
en la máquina de referencia (16 núcleos virtuales con una sesión de escritorio) `-t 8` subió la generación sin
caché de 13,9 a 26,9 tokens/s y con caché de 20,3 a 34,9 tokens/s. Probá valores de `-t` entre la mitad y la
totalidad de los núcleos físicos.

<a id="checkpoints"></a>
### Checkpoints de contexto

Los modelos con capas recurrentes o de ventana deslizante (por ejemplo los híbridos Qwen3.5/3.6/3.8,
Nemotron-H, Granite 4 o Gemma con SWA) no pueden deshacer su estado, así que cuando una solicitud cambia una
parte anterior de la conversación, el servidor continúa desde el checkpoint más reciente anterior al cambio.
Los checkpoints se ubican al comienzo de los mensajes de usuario, asistente y herramienta (donde los agentes de
programación eliminan razonamientos viejos o recortan resultados de herramientas) y al menos cada
`--checkpoint-min-step` tokens (1024 por defecto, antes 8192), sin pasadas adicionales por el prompt. Al llegar
a `--ctx-checkpoints` (32), se elimina el checkpoint más próximo a sus vecinos, así los demás siguen repartidos
por la conversación. En el escenario de agente de referencia (14 000 tokens, ocho resultados de herramientas),
recortar un resultado tardío pasó de 19,3 s a 5,5 s y uno temprano de 18,0 s a 13,6 s. Cada checkpoint guarda en
la memoria del host el estado recurrente o de ventana deslizante (63 MiB en Qwen3.6-35B-A3B).

<a id="upstream-options"></a>
### Opciones actualizadas y diagnóstico

Conviene mantener `--load-mode mmap`, predeterminado, cuando funciona el registro de memoria. `--load-mode none` es una alternativa si ese registro falla. `--load-mode dio` utiliza ahora un buffer auxiliar de hasta 64 MiB; no es un límite de RAM total del modelo.

`GGML_CUDA_PEER_MAX_BATCH_SIZE` se retiró porque no tenía efecto durante la ejecución. Las antiguas opciones de carga (`--mmap`, `--no-mmap`, `--mlock`, `--direct-io`, `--no-direct-io`) y el flag de compilación `GGML_CUDA_FA_ALL_QUANTS` ya no se aceptan; sus sustitutos están en [compatibilidad eliminada](#removed-compatibility). En una compilación CMake manual, `-DGGML_CUDA_FA_QUANTS=q8_0-q4_0` añade esa combinación K/V de kernels vectoriales; se admiten listas con comas o con punto y coma entre comillas. La lista predeterminada es `q4_0-q4_0;q8_0-q8_0;f16-f16;bf16-bf16`; F16 se incluye siempre. `all` aumenta el trabajo de compilación. Si falta una combinación vectorial, se convierte a F16, lo que puede ser más lento.

Los GGUF completos de GLM-4.5-Air (`glm4moe`) con un único cabezal pueden activar MTP automático. Se mantienen las demás comprobaciones y la prioridad de las opciones explícitas. MTP separa grafos con y sin salidas, conserva el orden original de tokens de secuencias concurrentes y usa las posiciones reales después de imágenes.

El ajuste automático cuenta las capas nextn (MTP), así que la primera capa ya no queda en la CPU cuando MTP está desactivado. Los pesos MTP ahora quedan siempre en la memoria de la GPU; consultá [ubicación de MTP](#mtp-vram). El valor por defecto de `--checkpoint-min-step` ahora es 1024 en lugar de 8192; consultá [checkpoints de contexto](#checkpoints). `--moe-cache`, `--no-moe-cache`, `--moe-cache-size` y `--moe-cache-reserve` controlan la [caché de expertos MoE](#expert-cache).

Con `--metrics`, `GET /api/metrics` autenticado incluye `llamacpp:spec_decode_num_draft_tokens_total`, `llamacpp:spec_decode_num_accepted_tokens_total`, `llamacpp:spec_decode_num_drafts_total` y `llamacpp:spec_decode_num_accepted_tokens_per_pos_total{position="N"}`. Las posiciones empiezan en cero; esa serie aparece al completar una solicitud especulativa. La aceptación se puede evaluar con las diferencias de contadores aceptados/propuestos; la latencia debe medirse por separado, porque una aceptación alta no demuestra por sí sola más velocidad. En modo router se elige el modelo con `?model=ID_MODELO`.

Las exportaciones leen el árbol completo de mensajes y los metadatos persistidos. Si las herramientas del servidor responden con 403, los mensajes nuevos dejan de repetir la consulta fallida; abrir de nuevo el panel de herramientas permite reintentar. Los valores del servidor en la primera visita conservan los ajustes ya modificados por el usuario, incluida la clave de API.

[Implementación y fuentes de upstream](CODE.es-AR.md#upstream-review).

<a id="removed-compatibility"></a>
## Compatibilidad eliminada

Se eliminó el código de retrocompatibilidad. Los nombres antiguos ya no se traducen ni
generan avisos: el servidor rechaza como argumentos no válidos las opciones de
línea de comandos eliminadas, ignora las variables de entorno eliminadas y
responde 404 en las rutas eliminadas. Los scripts, las personalizaciones de los
servicios, los presets y los clientes tienen que usar los sustitutos de esta tabla.

| Eliminado | Sustituto |
| --- | --- |
| `--mmap` / `--no-mmap` | `--load-mode mmap` / `--load-mode none` |
| `--mlock` | `--load-mode mlock` (o `mmap+mlock` para combinar ambos) |
| `-dio`, `--direct-io` / `-ndio`, `--no-direct-io` | `--load-mode dio` / `--load-mode none` |
| `-dt`, `--defrag-thold` | Nada; no tenía efecto. |
| `--swa-checkpoints` | `-ctxcp`, `--ctx-checkpoints` |
| `--webui`, `--no-webui`, `--webui-config`, `--webui-config-file`, `--webui-mcp-proxy`, `--no-webui-mcp-proxy` | `--ui`, `--no-ui`, `--ui-config`, `--ui-config-file`, `--ui-mcp-proxy`, `--no-ui-mcp-proxy` |
| Alias antiguos del modelo de borrador, como `-md`/`--model-draft`, `-ngld`/`--gpu-layers-draft`, `-td`/`--threads-draft`, `-devd`/`--device-draft`, `-ctkd`/`--cache-type-k-draft`, `-hfd`/`--hf-repo-draft` o `--draft-p-min` | La opción `--spec-draft-*` equivalente, por ejemplo `--spec-draft-model`, `--spec-draft-ngl`, `--spec-draft-threads`, `--spec-draft-device`, `--spec-draft-type-k`, `--spec-draft-hf` o `--spec-draft-p-min`. `mgs --help` las muestra todas. |
| `--draft`, `--draft-n`, `--draft-max` / `--draft-min`, `--draft-n-min` | `--spec-draft-n-max` o `--spec-ngram-mod-n-max` / `--spec-draft-n-min` o `--spec-ngram-mod-n-min` |
| `--spec-ngram-size-n`, `--spec-ngram-size-m`, `--spec-ngram-min-hits` | La opción `--spec-ngram-*-size-n`, `--spec-ngram-*-size-m` o `--spec-ngram-*-min-hits` del modo n-gram elegido |
| Variables de entorno `LLAMA_ARG_NO_<NOMBRE>` | `LLAMA_ARG_<NOMBRE>=false` |
| `LLAMA_ARG_MMAP`, `LLAMA_ARG_MLOCK`, `LLAMA_ARG_DIO` | `LLAMA_ARG_LOAD_MODE` |
| `LLAMA_ARG_DRAFT_MAX`, `LLAMA_ARG_DRAFT_MIN`, `LLAMA_ARG_DEFRAG_THOLD` | `LLAMA_ARG_SPEC_DRAFT_N_MAX`, `LLAMA_ARG_SPEC_DRAFT_N_MIN`; nada para el umbral de desfragmentación |
| `HF_ENDPOINT` | `MODEL_ENDPOINT` |
| `HUGGINGFACE_HUB_CACHE` | `HF_HUB_CACHE` o `LLAMA_CACHE` |
| `POST /api/completion` | `POST /api/completions` |
| `POST /api/embedding` | `POST /api/embeddings` o `POST /api/v1/embeddings` |
| `POST /api/reranking`, `POST /api/v1/reranking` | `POST /api/rerank`, `POST /api/v1/rerank` |
| Valor `deepseek-legacy` de `reasoning_format` (campo de petición y `--reasoning-format`) | `deepseek` o `auto`; el razonamiento se devuelve en `reasoning_content` |
| Campo de petición `reasoning_budget_end_tag` | `reasoning_budget_end_tags` (array de cadenas) |
| `reasoning_in_content` en `generation_settings` | Nada; el campo se eliminó. |
| CMake `LLAMA_CUDA`, `LLAMA_CUBLAS`, `LLAMA_METAL`, `LLAMA_METAL_EMBED_LIBRARY`, `LLAMA_NATIVE`, `LLAMA_RPC`, `LLAMA_SYCL`, `LLAMA_SYCL_F16`, `LLAMA_CANN` | La opción `GGML_*` equivalente, por ejemplo `GGML_CUDA` o `GGML_NATIVE` |
| CMake `LLAMA_CURL` | Nada; ya se ignoraba. |
| CMake `LLAMA_BUILD_WEBUI`, `LLAMA_USE_PREBUILT_WEBUI`, `LLAMA_WEBUI_HF_BUCKET` y la variable de entorno `HF_WEBUI_VERSION` | `LLAMA_BUILD_UI`, `LLAMA_USE_PREBUILT_UI`, `LLAMA_UI_HF_BUCKET`, `HF_UI_VERSION` |
| CMake `GGML_CUDA_FA_ALL_QUANTS=ON` | `GGML_CUDA_FA_QUANTS=all` |
| `bash install/install.sh` | `bash deploy/install-update-reinstall-debian.sh` |
| Opción `--no-sudo` de los instaladores | Nada; los instaladores siempre se ejecutan como root y sin sudo. |

CMake avisa de que las variables `-D` eliminadas no se utilizan, en lugar de
aplicarlas, así que conviene revisar la salida de configuración de las
compilaciones manuales.

La interfaz web ya no lee ni migra datos guardados por versiones anteriores:
ajustes y conversaciones con el antiguo prefijo de almacenamiento `LlamaCppWebui`
y la base de datos `LlamacppWebui`, la clave independiente `theme`, los marcadores
de razonamiento y de llamadas a herramientas incrustados en mensajes antiguos, los
adjuntos de texto pegado del antiguo tipo `context`, el antiguo formato de lista de
recomendaciones MCP descartadas y el antiguo campo `webui_settings` del servidor.
Los datos que una versión anterior ya migró siguen disponibles. La importación de
conversaciones solo acepta exportaciones JSONL y ZIP; el antiguo formato de
exportación JSON se rechaza.

`deploy/configure-web.sh` ya no desactiva el sitio `llama-server-moe` que los
primeros despliegues añadían al Apache del sistema
(`sites-enabled/llama-server-moe.conf` en Debian/Ubuntu,
`conf.d/zz-llama-server-moe.conf` en Alpine). Si alguno de esos archivos sigue
existiendo, hay que desactivarlo o eliminarlo manualmente y recargar Apache.

El proyecto cambió de nombre de `llama-server-moe` a `moe-gguf-server`, y el ejecutable ahora se llama
`mgs`. Las instalaciones hechas con el nombre anterior no se migran. Al reinstalar se crean los servicios
`moe-gguf-server` y `moe-gguf-server-web`, la cuenta `moe-gguf-server` y las carpetas
`/opt/moe-gguf-server` y `/etc/moe-gguf-server` al lado de las anteriores. Después de reinstalar, mové los
modelos de `/opt/llama-server-moe/models` a `/opt/moe-gguf-server/models` y entregáselos a la cuenta nueva
(`chown -R moe-gguf-server:moe-gguf-server /opt/moe-gguf-server/models`); para conservar la clave de la API,
copiá `/etc/llama-server-moe/api.key` sobre `/etc/moe-gguf-server/api.key` y reiniciá los dos servicios nuevos.
Después detené, desactivá y
eliminá los servicios `llama-server-moe` y `llama-server-moe-web`, `/usr/local/bin/llama-server-moe`,
`/usr/local/libexec/llama-server-moe`, las carpetas anteriores y la cuenta `llama-server-moe`. Las compilaciones locales ahora se instalan en
`~/.local` (`bin/mgs` y `lib/mgs/`); la carpeta anterior `~/IA/Apps/llama-server-moe/` se puede
borrar.

### Archivos de modelo antiguos

También se eliminó el código de compatibilidad con estas conversiones antiguas.
Para usarlas hay que volver a convertir el modelo original o descargar un GGUF
actual.

| Archivo antiguo | Comportamiento actual |
| --- | --- |
| Grok-1 convertido antes de agosto de 2025 (sin `grok.logit_scale`, `grok.embedding_scale`, `grok.attention.output_scale` o `grok.attn_logit_softcapping`) | No carga: falta una clave. |
| MiniCPM 1B/2B y MiniCPM-MoE-8x2B sin `minicpm.embedding_scale`, `minicpm.residual_scale` y `minicpm.logit_scale` | No carga: falta una clave. |
| Primeras conversiones de GLM-4.7-Flash sin `deepseek2.expert_gating_func` | Carga, pero elige los expertos con softmax en lugar de sigmoid, lo que empeora la salida. |
| Kimi-Linear con el tensor sin dividir `blk.N.attn_kv_b` | No carga: faltan `attn_k_b`/`attn_v_b`. Esa ruta ya fallaba al construir el grafo. |
| Modelos de 2023 con contexto ampliado que solo traen `rope.scale_linear` (por ejemplo LLaMA-2-7B-32K o Vicuna-v1.5-16k) | Carga sin escalado RoPE, así que el contexto largo funciona mal. |
| Gemma 2 convertido antes de que existiera `gemma2.attention.sliding_window` (finales de junio y principios de julio de 2024) | No carga: falta una clave. |
| mmproj de MiniCPM-Llama3-V 2.5 sin `clip.minicpmv_version` (anterior a mediados de agosto de 2024) | El proyector no carga. |

Se conservan los respaldos de los que todavía dependen las conversiones actuales:
el `add_bos` predeterminado de los pre-tokenizadores Llama 3, Tekken y similares,
el BOS forzado de Gemma 4, el softmax predeterminado de los archivos antiguos de
DeepSeek V2/V2.5, las claves opcionales de T5 y el respaldo de `query_num` de
MiniCPM-V.

<a id="maintenance"></a>
## Mantenimiento y resolución de problemas

- Repetí el comando `curl | bash` para actualizar desde `main`, o el instalador local correspondiente para recompilar y sustituir el ejecutable.
  Después reiniciá el servicio con `systemctl restart moe-gguf-server` en Debian
  o `rc-service moe-gguf-server restart` en Alpine.
- Consultá `/root/webapp-install.log`, `journalctl -u moe-gguf-server` en Debian
  o `/var/log/moe-gguf-server.log` en Alpine. Los registros Apache están en
  `/var/www/DOMINIO-logs/`.
- Si no podés compilar CUDA, instalá el Toolkit por separado o utiliza `--cpu`.
  Si falta NCCL, revisá los repositorios y la versión de CUDA, o elegí `--no-nccl`.
- Si falla la interfaz, comprobá Node.js, npm, las descargas y el registro.
  No sustituyas la interfaz por una precompilada del proyecto original.
- Para deploy, tras reorganizar los fuentes, utilizá una compilación nueva en `_/temp/`.
  SSHFS puede impedir ejecutar archivos; usá un disco local en producción.
- Para la compilación local, repetí el comando de una línea anterior para descargar
  el `main` actual, o `bash build/build-local.sh` para usar tus fuentes locales, y reiniciá la copia
  que lanzaste a mano. Consultá la salida de la terminal si falla o informa
  bibliotecas fuera de `lib/`. El registro temporal `build.log` se elimina junto
  con la carpeta de compilación.
- Un 404 en clientes antiguos suele requerir cambiar la URL base a `/api/v1`.
  La clave API debe enviarse en la cabecera Authorization.

Las reglas impiden que el asistente ejecute pruebas, despliegues de prueba,
mediciones GPU o comprobaciones automatizadas en navegadores móviles. La revisión
estática no garantiza el funcionamiento en ejecución. Consulta
[CODE.es-AR.md](CODE.es-AR.md) para ver el mapa de implementación.
