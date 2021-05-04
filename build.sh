#!/bin/bash

rm -f nclient-module-server*.tgz
node increase_version.js
npm pack
cp nclient-module-server-*.tgz nclient-module-server.tgz
curl -F "file=@./nclient-module-server.tgz" http://159.69.2.203:3030/upload
