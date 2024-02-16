<template>
  <q-page-sticky position="top-right" :offset="[10, 10]">
    <q-fab icon="fa-solid fa-wrench" active-icon="fa-solid fa-xmark" direction="down" push glossy square color="grey-6"
      title="Toolset">
      <q-fab-action v-for="(tool, i) in tools" :key="`tool${i}`" push glossy square color="amber-8"
        :disable="s3Object.isOperObj" :icon="tool.icon" :title="tool.name" :class="getToolStatus(tool.name)"
        @click="tool.func" />
    </q-fab>
  </q-page-sticky>

  <q-dialog v-model="queryDlg" maximized>
    <q-card class="column">
      <q-card-section>
        <q-input bg-color="light-blue-2" filled v-model="queryString" input-class="text-h6" @keydown="pressEnterForQuery"
          autofocus>
          <template v-slot:prepend>
            <div class="text-h6 text-bold">Object name :</div>
          </template>
          <template v-slot:append>
            <q-icon name="fa-solid fa-magnifying-glass" style="cursor: pointer" title="Query object" @click="queryObj" />
          </template>
          <template v-slot:after>
            <q-btn icon="fa-solid fa-xmark" color="grey-6" round glossy push v-close-popup />
          </template>
        </q-input>
      </q-card-section>
      <q-card-section class="col">
        <div class="fit column" style="border: 6px inset lightblue">
          <div class="full-width text-h6 text-bold row">
            <div class="ellipsis q-pl-md col-8">Directory</div>
            <div class="ellipsis col-3">LastModified</div>
            <div class="ellipsis col">Size</div>
          </div>
          <q-scroll-area class="col">
            <q-list separator>
              <q-item v-for="(result, i) in queryResult" :key="i" class="q-px-none">
                <q-item-section>
                  <q-item-label class="row">
                    <div class="ellipsis q-pl-md text-blue-7 cursor-pointer col-8" style="text-decoration: underline;"
                      v-close-popup @click="viewQueryResult(result)">
                      {{ result.objKey }}
                    </div>
                    <div class="ellipsis col-3">{{ result.lastModified }}</div>
                    <div class="ellipsis col">{{ result.sizeStr }}</div>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-scroll-area>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>

  <q-dialog v-model="objVerDlg">
    <q-card class="column" style="width: 800px; max-width: none; height: 70vh">
      <q-card-section class="row item-center">
        <div class="text-h6 text-bold text-primary">
          {{ objVerDlgTitle }}
        </div>
        <q-space />
        <q-btn icon="fa-solid fa-xmark" flat dense round v-close-popup @click="appStatus.newObjVerIndex = null" />
      </q-card-section>
      <q-separator />
      <q-card-section class="col full-width row" horizontal>
        <q-card-section class="col">
          <q-scroll-area class="fit">
            <q-list class="fit" separator>
              <q-item clickable v-ripple active-class="bg-light-blue-3 text-indigo-8"
                v-for="(obj, i) in appStatus.curObjVerList" :key="i" :active="appStatus.newObjVerIndex === i"
                @click="appStatus.newObjVerIndex = i">
                <q-item-section avatar>
                  <q-icon name="fa-regular fa-file" />
                </q-item-section>
                <q-item-section class="text-subtitle1 text-bold">
                  <q-item-label>{{ `ver ${i + 1}` }}</q-item-label>
                  <q-item-label caption>
                    <span class="text-italic">{{
                      `Created at ${obj.createdAt}`
                    }}</span>
                    <span class="q-ml-xl">{{ obj.size }}</span>
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-scroll-area>
        </q-card-section>
        <q-separator vertical />
        <q-card-section class="col row justify-center items-center">
          <object v-if="appStatus.curObjVerList.length && appStatus.newObjVerIndex !== null" :data="previewObjUrl"
            style="max-width: 100%; max-height: 100%" />
        </q-card-section>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="q-my-sm">
        <q-btn color="primary" glossy push label="Switch" @click="s3Object.changeObjVersion" v-close-popup
          :disable="appStatus.newObjVerIndex === null" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import {
  computed, nextTick, ref, watch,
} from 'vue';
import { useAppStatusStore } from 'src/stores/appStatus';
import { useS3ObjectStore } from 'src/stores/s3Object';
import { useAlertHandlerStore } from 'src/stores/alertHandler';

const appStatus = useAppStatusStore();
const s3Object = useS3ObjectStore();
const { makeAlert } = useAlertHandlerStore();

const queryDlg = ref(false);
const queryString = ref('');
const queryResult = ref([]);

const objVerDlg = ref(false);
const objVerDlgTitle = ref('');
const previewObjUrl = computed(() => (
  `https://${s3Object.curBucket}.s3.ap-northeast-1.amazonaws.com`
  + `${appStatus.selections[0]}?versionId=${appStatus.curObjVerList[appStatus.newObjVerIndex].verId}`
));

async function inputNewName() {
  await nextTick();
  appStatus.isOperObj = true;

  const originalName = appStatus.selections[0].split('/').slice(-1)[0];
  const extensionLen = originalName.split('.').slice(-1)[0].length + 1;
  const inputFieldEle = document.getElementById(`input-${appStatus.selections[0]}`);

  inputFieldEle.focus();
  appStatus.onModifying = true;

  if (s3Object.bucketStructure[s3Object.curDirectory][appStatus.selections[0]].isFile) {
    inputFieldEle.setSelectionRange(0, originalName.length - extensionLen);
  } else inputFieldEle.select();
}

async function createFolder() {
  const defaultName = `NewFolder ${Date.now()}`;
  const newFolderEleId = `${s3Object.curDirectory !== '/' ? `${s3Object.curDirectory}/` : '/'}${defaultName}`;

  (s3Object.bucketStructure[s3Object.curDirectory] ??= {})[newFolderEleId] = {
    name: defaultName,
    isFile: false,
  };
  await nextTick();

  appStatus.onCreatingFolder = true;
  appStatus.preName = defaultName;
  appStatus.tempName = defaultName;
  appStatus.renameObjId = newFolderEleId;
  appStatus.selections = [newFolderEleId];
  inputNewName();
}

function cutObj() {
  appStatus.cutStorage = [];
  appStatus.cutStorage = appStatus.selections.slice();
  /*
  appStatus.selections.forEach((selected) => {
    appStatus.cutStorage.push(selected.id);
  });
  */
  makeAlert('info', 'cutObj', 'Success to cut the selections to storage');
}

function findPasteConflict() {
  const curDirObjsNames = Object.keys(s3Object.bucketStructure[s3Object.curDirectory] || {})
    .map((dir) => dir.split('/').slice(-1)[0]);
  const cutObjsNames = appStatus.cutStorage.map((obj) => obj.split('/').slice(-1)[0]);

  return cutObjsNames.some((objName) => curDirObjsNames.includes(objName));
}

async function pasteObj() {
  if (findPasteConflict()) {
    makeAlert('error', 'pasteObj', 'The object with same name has already existed');
  } else {
    await s3Object.modifyObject('paste', appStatus.cutStorage);
    appStatus.cutStorage = [];
  }
}

function renameObj() {
  [appStatus.preName] = appStatus.selections[0].split('/').slice(-1);
  appStatus.tempName = appStatus.preName;
  [appStatus.renameObjId] = appStatus.selections;
  inputNewName();
}

function queryObj() {
  const allObjsInBucket = Object.entries(s3Object.bucketStructure);

  queryResult.value = [];
  allObjsInBucket.forEach(([dir, objsIndir]) => {
    Object.keys(objsIndir).forEach((objKey) => {
      const objName = objKey.split('/').slice(-1)[0];

      if (objName.includes(queryString.value)) {
        queryResult.value.push({
          dir,
          objKey,
          lastModified: objsIndir[objKey].lastModified,
          sizeStr: objsIndir[objKey].sizeStr || '',
        });
      }
    });
  });
}

function pressEnterForQuery(e) {
  if (e.key === 'Enter') queryObj();
}

function viewQueryResult(result) {
  appStatus.selections = [];
  appStatus.queryTarget = result.objKey;
  if (s3Object.curDirectory === result.dir) {
    appStatus.objDisplayArea.scrollTo(
      s3Object.objsInCurDir.findIndex((obj) => obj[0] === appStatus.queryTarget),
      'center',
    );
  } else {
    appStatus.preStep.push(s3Object.curDirectory);
    s3Object.curDirectory = result.dir;
  }
}

async function listObjVers() {
  appStatus.isProcessing = true;
  await s3Object.getObjVersions();
  appStatus.isProcessing = false;
  objVerDlg.value = true;
}

const tools = [
  {
    name: 'Download',
    icon: 'fa-solid fa-download',
    func: s3Object.downloadFiles,
  }, {
    name: 'NewFolder',
    icon: 'fa-solid fa-folder-plus',
    func: createFolder,
  }, {
    name: 'Cut',
    icon: 'fa-solid fa-scissors',
    func: cutObj,
  }, {
    name: 'Paste',
    icon: 'fa-solid fa-paste',
    func: pasteObj,
  }, {
    name: 'Rename',
    icon: 'fa-solid fa-pen-to-square',
    func: renameObj,
  }, {
    name: 'Delete',
    icon: 'fa-solid fa-trash-can',
    func: s3Object.deleteObject,
  }, {
    name: 'Query',
    icon: 'fa-solid fa-magnifying-glass',
    func: () => { queryDlg.value = true; },
  }, {
    name: 'SwitchVersion',
    icon: 'fa-solid fa-clock-rotate-left',
    func: listObjVers,
  },
];

function getToolStatus(tool) {
  switch (tool) {
    case 'Download':
      return !appStatus.onlySelectFile || !appStatus.selections.length ? 'hidden' : '';
    case 'Paste':
      return !appStatus.cutStorage.length ? 'hidden' : '';
    case 'NewFolder':
      return !appStatus.selections.length ? '' : 'hidden';
    case 'Query':
      return '';
    default:
      return appStatus.selections.length === 0 ? 'hidden' : '';
  }
}

watch(objVerDlg, (v) => {
  if (v) {
    objVerDlgTitle.value = `${appStatus.selections[0].split('/').slice(-1)[0]} version list`;
  }
});
</script>
