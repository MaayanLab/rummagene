#/bin/sh

cat >> /var/lib/postgresql/data/postgresql.conf << EOF
search_path = '"$user", public, app_public_v2, app_private_v2'
EOF
