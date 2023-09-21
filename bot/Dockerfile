FROM python

COPY deps.txt /tmp/deps.txt
RUN set -x \
  && apt-get update -y \
  && xargs apt-get -y install < /tmp/deps.txt \
  && rm -rf /var/lib/apt/lists/* /tmp/deps.txt

COPY requirements.txt /tmp/requirements.txt
RUN set -x \
  && pip install -r /tmp/requirements.txt --break-system-packages \
  && rm /tmp/requirements.txt

WORKDIR /work
VOLUME ["/work/data"]

ADD ./plpy.py .
ADD ./helper.py .
ADD ./download_extract.py .
ADD ./clean.py .
ADD ./bot.sh .
RUN chmod +x bot.sh
