FROM python:3.11

COPY deps.txt /tmp/deps.txt
RUN set -x \
  && apt-get update -y \
  && xargs apt-get -y install < /tmp/deps.txt \
  && rm -rf /var/lib/apt/lists/* /tmp/deps.txt \
  && pip install uv --break-system-packages

WORKDIR /work
VOLUME ["/work/data"]

ADD ./requirements.txt requirements.txt
RUN set -x \
  && uv venv \
  && uv pip install -r requirements.txt \
  && rm requirements.txt

ADD ./helper helper
ADD ./download_extract.py .
ADD ./bot.sh .
RUN chmod +x bot.sh
