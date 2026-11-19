# syntax=docker/dockerfile:1
ARG UBUNTU_VERSION=26.04
ARG UV_PYTHON_VERSION=3.11
ARG GO_VERSION=1.27
ARG RCLONE_RELEASE=v1.76.0
ARG GSON_VERSION=2.14.0

FROM ghcr.io/astral-sh/uv:latest AS uv

# rclone, built from source with the latest Go toolchain and patched dependencies
#  (the upstream release binaries lag behind on Go stdlib / dependency security fixes)
FROM golang:${GO_VERSION} AS rclone
ARG RCLONE_RELEASE
RUN set -eux; \
    git clone --depth 1 --branch "${RCLONE_RELEASE}" https://github.com/rclone/rclone /src; \
    cd /src; \
    go get go.opentelemetry.io/otel@latest go.opentelemetry.io/otel/trace@latest golang.org/x/crypto@latest; \
    go mod tidy; \
    CGO_ENABLED=0 go build -trimpath -ldflags "-s -X github.com/rclone/rclone/fs.Version=${RCLONE_RELEASE}" -o /rclone .; \
    /rclone version

FROM ubuntu:${UBUNTU_VERSION} AS build
ARG DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TZ=Etc/UTC

# System dependencies
#  default-jre-headless: tabula-py (PDF table extraction)
#  libreoffice-writer-nogui: `soffice --convert-to docx` for legacy .doc files
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      tini \
      default-jre-headless \
      libreoffice-writer-nogui \
    ; \
    rm -rf /var/lib/apt/lists/*; \
    # the base image ships pebble (an unused service manager) outside of dpkg
    rm -f /usr/bin/pebble; \
    # ubuntu images ship an unprivileged `ubuntu` user since 23.04; create it on older releases
    id ubuntu >/dev/null 2>&1 || useradd --create-home --uid 1000 --shell /bin/bash ubuntu

COPY --from=rclone /rclone /usr/local/bin/rclone

# Python (managed by uv, in a venv owned by the unprivileged user)
#  uv is only mounted at build time so it doesn't end up in the final image
ARG UV_PYTHON_VERSION
ENV UV_PYTHON_INSTALL_DIR=/opt/uv/python \
    UV_PYTHON_PREFERENCE=only-managed \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    VIRTUAL_ENV=/home/ubuntu/.venv \
    PATH=/home/ubuntu/.venv/bin:$PATH
RUN --mount=from=uv,source=/uv,target=/usr/local/bin/uv \
    set -eux; \
    uv venv --no-cache --python "${UV_PYTHON_VERSION}" "${VIRTUAL_ENV}"; \
    # the venv doesn't use the interpreter's own pip/setuptools, drop them (and their vendored packages)
    rm -rf /opt/uv/python/*/lib/python*/site-packages/pip* /opt/uv/python/*/lib/python*/site-packages/setuptools* \
      /opt/uv/python/*/lib/python*/site-packages/_distutils_hack /opt/uv/python/*/lib/python*/site-packages/distutils-precedence.pth \
      /opt/uv/python/*/lib/python*/site-packages/pkg_resources; \
    chown -R ubuntu:ubuntu "${VIRTUAL_ENV}"

# Python dependencies (git is only needed to fetch git+ requirements, so it is removed afterwards)
COPY requirements.txt /tmp/requirements.txt
RUN --mount=from=uv,source=/uv,target=/usr/local/bin/uv \
    set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends git; \
    uv pip install --no-cache -r /tmp/requirements.txt; \
    apt-get purge -y --auto-remove git; \
    rm -rf /var/lib/apt/lists/* /tmp/requirements.txt; \
    chown -R ubuntu:ubuntu "${VIRTUAL_ENV}"

# tabula-py's bundled tabula-java jar embeds an outdated gson (CVE-2022-25647), swap in a current one
ARG GSON_VERSION
RUN python - <<'EOF'
import glob, hashlib, io, os, urllib.request, zipfile
version = os.environ['GSON_VERSION']
url = f"https://repo1.maven.org/maven2/com/google/code/gson/gson/{version}/gson-{version}.jar"
gson = urllib.request.urlopen(url).read()
sha1 = urllib.request.urlopen(url + '.sha1').read().decode().split()[0]
assert hashlib.sha1(gson).hexdigest() == sha1, 'gson checksum mismatch'
gson_zip = zipfile.ZipFile(io.BytesIO(gson))
for jar in glob.glob(f"{os.environ['VIRTUAL_ENV']}/lib/python*/site-packages/tabula/*.jar"):
  with zipfile.ZipFile(jar) as src, zipfile.ZipFile(jar + '.new', 'w', zipfile.ZIP_DEFLATED) as dst:
    for item in src.infolist():
      if item.filename.startswith(('com/google/gson/', 'META-INF/maven/com.google.code.gson/')): continue
      dst.writestr(item, src.read(item))
    for item in gson_zip.infolist():
      if item.filename.startswith(('com/google/gson/', 'META-INF/maven/com.google.code.gson/')):
        dst.writestr(item, gson_zip.read(item))
  os.replace(jar + '.new', jar)
EOF

# Flatten into a single layer so files removed or replaced above (e.g. the base image's pebble,
#  the original tabula jar) don't linger in lower layers
FROM scratch
COPY --from=build / /
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TZ=Etc/UTC \
    VIRTUAL_ENV=/home/ubuntu/.venv \
    PATH=/home/ubuntu/.venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Run everything from here on as the unprivileged `ubuntu` user (uid 1000)
USER ubuntu
WORKDIR /home/ubuntu/app

COPY --chown=ubuntu:ubuntu ./helper helper
COPY --chown=ubuntu:ubuntu --chmod=755 ./bot.sh .
COPY --chown=ubuntu:ubuntu ./download_extract.py .

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["./bot.sh"]
