# Rummagene Bot

This contains the code for downloading from the Open Access PMC Bulk Download FTP server, extracting gene sets, and loading them into the rummagene database.

## Details
- `download_extract.py`: is what was used to make the gmt's provided for download above -- it grabs papers from the open access PMC bulk download FTP server, extracts tables from those papers from various file formats, and then grabs columns in those tables with more than 50% of the rows being mappable gene sets.
- `python -m helper *` is used to ingest the output of `download_extract.py` into the rummagene database, and produce any additional supplemental tables
- `bot.sh` is the cron-job script, executed weekly to incrementally update the rummagene database
