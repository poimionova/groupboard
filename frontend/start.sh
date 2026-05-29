#!/bin/sh
sed -i "s/RAILWAY_PORT/${PORT:-80}/g" /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
