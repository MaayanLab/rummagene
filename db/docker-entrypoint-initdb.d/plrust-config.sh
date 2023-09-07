#/bin/sh
cat >> /var/lib/postgresql/data/postgresql.conf << EOF
shared_preload_libraries = 'plrust'
plrust.work_dir = '/tmp'
plrust.path_override = '/var/lib/postgresql/.cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/lib/postgresql/15/bin'
EOF