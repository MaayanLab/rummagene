#!/bin/sh
# this script is meant to run as a weekly cronjob.
# it assumes that the rummagene directory is next to the tablemining directory

PYTHON=python
which $PYTHON > /dev/null || exit 1

WORK_DIR=data/$(date +%Y-%m-%d)
if [ -d $WORK_DIR ]; then rm -r $WORK_DIR; fi
mkdir -p $WORK_DIR
ln -s ../done.txt $WORK_DIR/done.txt

echo "assembling output.gmt... (new gene sets extracted from PMC articles)"
PTH=$WORK_DIR $PYTHON ./download_extract.py || exit 1

echo "assembling output-clean.gmt... (pruned, and normalized gene sets)"
PTH=$WORK_DIR $PYTHON ./clean.py || exit 1

echo "ingesting new gene sets..."
$PYTHON ./helper.py ingest -i $WORK_DIR/output-clean.gmt || exit 1

echo "downloading latest PMC metadata..."
curl -L https://ftp.ncbi.nlm.nih.gov/pub/pmc/PMC-ids.csv.gz > data/PMC-ids.csv.gz  || exit 1

echo "ingesting latest PMC metadata..."
$PYTHON ./helper.py ingest-paper-info || exit 1

echo "registering a new release..."
$PYTHON ./helper.py create-release "$(wc -l $WORK_DIR/done.new.txt | awk '{ print $1 }')" || exit 1

echo "updating app background..."
ENRICH_URL=$ENRICH_URL $PYTHON ./helper.py update-background || exit 1

echo "adding to output.gmt..."
cat $WORK_DIR/output.gmt >> data/output.gmt
cat $WORK_DIR/output-clean.gmt >> data/output-clean.gmt
cat $WORK_DIR/done.new.txt >> data/done.txt

# echo "cleanup work_dir..."
# rm $WORK_DIR
