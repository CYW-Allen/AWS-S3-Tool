<template>
  <div class="q-pa-sm row no-wrap">
    <q-btn-group push glossy>
      <q-btn color="indigo-8" icon="fa-solid fa-arrow-left" title="previous step" @click="switchCurView('previous')"
        :disable="!appStatus.preStep.length || appStatus.isOperObj" />
      <q-btn color="indigo-8" icon="fa-solid fa-arrow-right" title="next step" @click="switchCurView('next')"
        :disable="!appStatus.nextStep.length || appStatus.isOperObj" />
      <q-btn color="indigo-8" icon="fa-solid fa-arrow-up" title="parent level" @click="switchCurView('up')"
        :disable="s3Object.curDirectory === '/' || appStatus.isOperObj" />
    </q-btn-group>

    <q-scroll-area class="col dirBlock q-mx-sm bg-transparent">
      <div class="full-width dirBlock row justify-start items-center no-wrap bg-grey-3 glossy">
        <q-btn-dropdown class="dirKeys" v-for="([dirKey, dir], i) in s3Object.subDirsInCurDir" :key="`dirLevel-${i}`"
          :label="dirKey || '📁'" text-color="black" dropdown-icon="fa-solid fa-angle-right" size="lg" dense square split
          no-caps unelevated stretch content-class="bg-grey-4" @click="s3Object.curDirectory = dir" auto-close>
          <q-list>
            <q-item clickable v-for="(folder, j) in getCurLevelFolders(dir)" :key="`folder-${j}`"
              @click="s3Object.curDirectory = `${dir === '/' ? '' : dir}/${folder}`">
              <q-item-section class="q-mr-md">
                <q-item-label>{{ folder }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </div>
    </q-scroll-area>

    <q-btn v-if="s3Object.curCDNId" icon="fa-solid fa-arrow-rotate-right" title="refresh distribution"
      :class="`refreshBtn ${appStatus.refreshList.length ? 'glowing' : ''}`" glossy push text-color="white">
      <q-badge v-if="appStatus.refreshList.length" color="red" rounded floating />
    </q-btn>
  </div>
</template>

<script setup>
import { useAppStatusStore } from 'src/stores/appStatus';
import { useS3ObjectStore } from 'src/stores/s3Object';

const appStatus = useAppStatusStore();
const s3Object = useS3ObjectStore();

function switchCurView(direction) {
  if (direction === 'up') {
    if (s3Object.curDirectory !== '/') {
      const dirKeys = s3Object.curDirectory.split('/');

      dirKeys.pop();
      appStatus.preStep.push(s3Object.curDirectory);
      s3Object.curDirectory = dirKeys.length > 1 ? dirKeys.join('/') : '/';
    }
  } else {
    const input = direction === 'previous' ? appStatus.nextStep : appStatus.preStep;
    const output = direction === 'previous' ? appStatus.preStep : appStatus.nextStep;

    if (output.length) {
      if (input.slice(-1)[0] !== s3Object.curDirectory) input.push(s3Object.curDirectory);
      s3Object.curDirectory = output.pop();
    }
  }
}

function getCurLevelFolders(curLevel) {
  return Object.entries(s3Object.bucketStructure[curLevel] || {})
    .reduce((result, [objKey, objInfo]) => {
      if (!objInfo.isFile && !appStatus.reserveWords.includes(objKey)) {
        result.push(objInfo.name);
      }
      return result;
    }, []);
}
</script>

<style>
.dirKeys .q-btn__content .q-icon {
  font-size: 20px;
}
</style>

<style scoped>
.dirBlock {
  height: 50px !important;
}

.refreshBtn {
  background-color: #3eaa43;
}

.glowing {
  animation: glowing 2s linear infinite;
}

@keyframes glowing {
  0% {
    background-color: #3eaa43;
  }

  25% {
    background-color: #43ca4a;
  }

  50% {
    background-color: #53ec5b;
  }

  75% {
    background-color: #43ca4a;
  }

  100% {
    background-color: #3eaa43;
  }
}
</style>
