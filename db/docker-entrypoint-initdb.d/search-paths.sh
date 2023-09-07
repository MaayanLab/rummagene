#/bin/sh

cat >> /var/lib/postgresql/data/postgresql.conf << EOF
search_path = '"$user", public, app_public, app_private'
EOF
