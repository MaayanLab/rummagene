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
test -f $WORK_DIR/output.gmt || exit 1
test -f $WORK_DIR/done.new.txt || exit 1

echo "assembling output-clean.gmt... (pruned, and normalized gene sets)"
$PYTHON -m helper clean -i $WORK_DIR/output.gmt -o $WORK_DIR/output-clean.gmt || exit 1
test -f $WORK_DIR/output-clean.gmt || exit 1

echo "ingesting new gene sets..."
$PYTHON -m helper ingest -i $WORK_DIR/output-clean.gmt || exit 1

echo "fetching & ingesting latest PMC metadata..."
$PYTHON -m helper ingest-paper-info || exit 1

echo "registering a new release..."
$PYTHON -m helper create-release "$(wc -l $WORK_DIR/done.new.txt | awk '{ print $1 }')" || exit 1

echo "updating app background..."
ENRICH_URL=$ENRICH_URL $PYTHON -m helper update-background || exit 1

echo "adding to output.gmt..."
cat $WORK_DIR/output.gmt >> data/output.gmt
cat $WORK_DIR/output-clean.gmt >> data/output-clean.gmt
cat $WORK_DIR/done.new.txt >> data/done.txt

# echo "cleanup work_dir..."
# rm $WORK_DIR
