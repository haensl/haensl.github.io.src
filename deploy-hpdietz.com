#!/usr/bin/env bash
# vim: set syn=sh

source ${HOME}/.bashrc.local

readonly CONTAINER_NAME=haensl.github.io
readonly IMAGE_NAME=${CONTAINER_NAME}

docker build --no-cache -t ${IMAGE_NAME} .
docker save ${IMAGE_NAME} | bzip2 | pv | ssh $SERVER_USER@$SERVER 'bunzip2 | docker load'

readonly CONTAINER_STATUS=$(dserver ps -a --filter "name=${CONTAINER_NAME}" --format "{{.Status}}")
echo ${CONTAINER_STATUS} | \grep '^Up' > /dev/null
readonly SHOULD_STOP=$?
test ${#CONTAINER_STATUS} -gt 0
readonly SHOULD_RM=$?

if [ $SHOULD_STOP -eq 0 ]; then
  SHOULD_STOP_STR=yes
else
  SHOULD_STOP_STR=no
fi

if [ $SHOUL_RM -eq 0 ]; then
  SHOULD_RM_STR=yes
else
  SHOULD_RM_STR=no
fi

cat <<- EOF
  ${CONTAINER_NAME}
    Status: ${CONTAINER_STATUS}
    Should stop: ${SHOULD_STOP_STR}
    Should remove: ${SHOULD_RM_STR}
EOF

if [ ${SHOULD_STOP} -eq 0 ]; then
  dserver stop ${CONTAINER_NAME}
fi

if [ ${SHOULD_RM} -eq 0 ]; then
  dserver rm ${CONTAINER_NAME}
fi

dserver run \
  -d \
  --name ${CONTAINER_NAME} \
  --network=haensl-github-io \
  ${IMAGE_NAME}
