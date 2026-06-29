FROM maayanlab/base:1.6.0
COPY deps.txt deps.txt
RUN /install.sh && rm deps.txt
COPY requirements.txt requirements.txt
RUN PYTHON_VERSION=3.11 /install.sh && rm requirements.txt

COPY --chown=ubuntu ./helper helper
COPY --chown=ubuntu ./download_extract.py .
COPY --chown=ubuntu ./bot.sh .
RUN chmod +x bot.sh

CMD ["./bot.sh"]
