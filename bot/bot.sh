#!/bin/sh
# this script is meant to run as a weekly cronjob.
# it stores stuff in rclone path

PYTHON="uv run python"

# Example:
# RCLONE_PATH=s3:rummagene
# RCLONE_CONFIG_S3_TYPE=s3
# RCLONE_CONFIG_S3_PROVIDER=Other
# RCLONE_CONFIG_S3_ENDPOINT=https://s3.amazonaws.com
# RCLONE_CONFIG_S3_ACCESS_KEY_ID=
# RCLONE_CONFIG_S3_SECRET_ACCESS_KEY=

test ! -z "$RCLONE_PATH" || echo "Missing RCLONE_PATH and (with RCLONE_CONFIG)"
test ! -z "$RCLONE_PATH" || exit 1

TIMESTAMP=$(date +%Y-%m-%d)
WORK_DIR=$(mktemp -d)

rclone copy -P $RCLONE_PATH/latest/done.txt $WORK_DIR || exit 1

echo "assembling output.gmt... (new gene sets extracted from PMC articles)"
PTH=$WORK_DIR $PYTHON ./download_extract.py || exit 1
test -f $WORK_DIR/output.gmt || exit 1
test -f $WORK_DIR/done.new.txt || exit 1

echo "assembling output-clean.gmt... (pruned, and normalized gene sets)"
$PYTHON -m helper clean -i $WORK_DIR/output.gmt -o $WORK_DIR/output-clean.gmt || exit 1
test -f $WORK_DIR/output-clean.gmt || exit 1

echo "adding to RCLONE_PATH..."
rclone copy -P $WORK_DIR/output.gmt $RCLONE_PATH/$TIMESTAMP/ || exit 1
rclone copy -P $WORK_DIR/output-clean.gmt $RCLONE_PATH/$TIMESTAMP/ || exit 1
rclone copy -P $WORK_DIR/done.new.txt $RCLONE_PATH/$TIMESTAMP/ || exit 1

echo "updating latest..."
cat <(rclone cat $RCLONE_PATH/latest/output.gmt) $WORK_DIR/output.gmt | rclone rcat $RCLONE_PATH/latest/output.gmt
cat <(rclone cat $RCLONE_PATH/latest/output-clean.gmt) $WORK_DIR/output-clean.gmt | rclone rcat $RCLONE_PATH/latest/output-clean.gmt
cat $WORK_DIR/done.txt $WORK_DIR/done.new.txt | rclone rcat $RCLONE_PATH/latest/done.txt

echo "ingesting new gene sets..."
$PYTHON -m helper ingest -i $WORK_DIR/output-clean.gmt || exit 1

echo "fetching & ingesting latest PMC metadata..."
$PYTHON -m helper ingest-paper-info || exit 1

echo "fetching & ingesting gene description & summary..."
$PYTHON -m helper ingest-gene-info || exit 1

echo "registering a new release..."
$PYTHON -m helper create-release "$(wc -l $WORK_DIR/done.new.txt | awk '{ print $1 }')" || exit 1

echo "updating app background..."
ENRICH_URL=$ENRICH_URL $PYTHON -m helper update-background || exit 1
