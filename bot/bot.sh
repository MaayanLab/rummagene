#!/bin/sh
# this script is meant to run as a weekly cronjob.
# it assumes that the rummagene directory is next to the tablemining directory

PYTHON=python

which $PYTHON || exit 1

echo "removing old oa_file_list.csv... (listing of PMC bundles)"
if [ -d ./data -a -f ./data/oa_file_list.csv ]; then 
  mv ./data/oa_file_list.csv ./data/oa_file_list.csv.bak
fi

# TODO: download_extract.py can have an argument to write *new*
#  items to another file, we then only have to clean and ingest the new
#  stuff, and can join it with the old stuff after
echo "updating output.gmt... (gene sets extracted from PMC articles)"
$PYTHON ./download_extract.py || exit 1

echo "updating output-clean.gmt... (pruned, and normalized gene sets)"
$PYTHON ./clean.py || exit 1

echo "ingesting new gene sets..."
$PYTHON ./helper.py ingest -i ./data/output-clean.gmt || exit 1

echo "updating total publications..."
$PYTHON ./helper.py set-total-publications "$(wc -l ./data/done.txt | awk '{ print $1 }')" || exit 1

echo "updating background..."
$PYTHON ./helper.py update-background || exit 1
