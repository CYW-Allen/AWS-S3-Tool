#!/bin/bash

cd api_server
npm i
fastify start -w -l info -P app.mjs &
pid_dev_server=$!

if [ $? -eq 0 ]; then
  counter=0
  deadline=300

  echo "Waiting for the api server to be ready"
  sleep 5
  while ! (echo >/dev/tcp/localhost/3000) &>/dev/null && [[ $counter -lt $deadline ]]; do
    sleep 1
    counter=$((counter + 1))
  done

  if [ $counter -eq $deadline ]; then
    echo "Fail to connect to api server"
    kill $pid_dev_server
  else
    if ! (npm list --depth 1 --global @quasar/cli) &>/dev/null; then
      npm i -g @quasar/cli
    fi

    cd ../aws-s3-tool
    npm i
    quasar dev &
    pid_app=$!

    echo "Press Enter to stop"
    read -r
    kill $pid_dev_server $pid_app
  fi
else
  echo "Fail to launch the api server"
  kill $pid_dev_server
fi


