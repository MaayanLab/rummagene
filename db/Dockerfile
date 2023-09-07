FROM postgres:15

COPY deps.txt /tmp/deps.txt
RUN set -x \
  && apt-get update -y \
  && xargs apt-get -y install < /tmp/deps.txt \
  && rm -rf /var/lib/apt/lists/* /tmp/deps.txt

# https://tcdi.github.io/plrust/install-plrust-on-debian-ubuntu.html
USER postgres
RUN set -x \
  && curl https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain=1.72.0
RUN set -x \
  && $HOME/.cargo/bin/rustup toolchain install 1.72.0 \
  && $HOME/.cargo/bin/rustup default 1.72.0 \
  && $HOME/.cargo/bin/rustup component add rustc-dev
USER root
RUN set -x \
  && cd /tmp \
  && curl -LO https://github.com/tcdi/plrust/releases/download/v1.2.5/plrust-trusted-1.2.5_1.72.0-debian-pg15-amd64.deb \
  && apt install /tmp/plrust-trusted-1.2.5_1.72.0-debian-pg15-amd64.deb \
  && rm /tmp/plrust-trusted-1.2.5_1.72.0-debian-pg15-amd64.deb
COPY ./docker-entrypoint-initdb.d /docker-entrypoint-initdb.d

COPY requirements.txt /tmp/requirements.txt
RUN set -x \
  && pip install -r /tmp/requirements.txt --break-system-packages \
  && rm /tmp/requirements.txt
COPY sigcomlite.py /usr/lib/python3.11/sigcomlite.py