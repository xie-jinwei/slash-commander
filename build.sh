#!/bin/bash

# fail fast configuration
set -euo pipefail

# list action folders
actions=$(ls -d */ | sed 's/\///g')

# Compile typescript files into javascript
tsc

for action in ${actions}
do  
    if [ "${action}" != "lib" ] && [ "${action}" != "node_modules" ]; then
        echo "Building action ${action}" && ncc build lib/${action}/index.js -o ${action}/dist;
    else
        echo "Skipping ${action}"
    fi
done
