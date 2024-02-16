<template>
  <q-dialog v-model="isUploading" maximized>
    <q-card class="column bg-light-blue-1">
      <q-card-section>
        <div class="text-h5 text-bold text-primary q-mb-md">
          <span class="q-mr-sm">Object uploading</span>
          <q-spinner-dots color="primary" size="1em" />
        </div>
        <q-linear-progress class="q-mb-md" size="30px" :value="curProcessPercentage" color="light-blue-6"
          instant-feedback>
          <div class="absolute-full flex flex-center">
            <q-badge color="transparent" text-color="indigo-10" :label="curPercentageText" />
          </div>
        </q-linear-progress>
      </q-card-section>

      <q-card-section class="col row items-center">
        <div class="col full-height row justify-center items-center" style="border: 5px outset gray;">
          <q-spinner-gears v-if="!uploadingTree" color="primary" size="10em" />
          <div v-else class="fit column justify-start">
            <q-input filled square v-model="filter" debounce="500" placeholder="Search...">
              <template v-slot:prepend>
                <q-icon name="fa-solid fa-magnifying-glass" />
              </template>
              <template v-slot:append>
                <q-icon v-if="filter !== ''" name="fa-solid fa-eraser" class="cursor-pointer" @click="filter = ''" />
              </template>
            </q-input>

            <div class="col scroll">
              <q-tree class="fit" :nodes="uploadingTree" node-key="label" default-expand-all :filter="filter"
                no-transition>
                <template v-slot:default-header="prop">
                  <div class="row items-center">
                    <q-icon :name="prop.node.icon" :color="prop.node.type === 'folder' ? 'orange' : 'black'" size="28px"
                      class="q-mr-sm" />
                    <div class="text-weight-bold q-mr-sm">{{ prop.node.label }}</div>
                    <q-spinner-facebook v-if="appStatus.uploadStatus[prop.node.objKey] === 'processing'" color="primary"
                      size="1.5em" />
                    <q-icon v-if="appStatus.uploadStatus[prop.node.objKey] === 'success'" name="fa-solid fa-check"
                      color="green" />
                    <q-icon v-if="appStatus.uploadStatus[prop.node.objKey] === 'fail'" name="fa-solid fa-xmark"
                      color="red" />
                  </div>
                </template>
              </q-tree>
            </div>
          </div>
        </div>
        <div v-if="appStatus.uploadFails.length" class="col full-height column q-ml-sm" style="border: 5px outset red;">
          <q-field class="q-mb-sm" bg-color="red-2" filled square>
            <template v-slot:prepend>
              <div class="text-h6 text-bold">Fail: </div>
            </template>
            <template v-slot:control>
              <div class="text-h6 text-bold text-red-9">{{ appStatus.uploadFails.length }}</div>
            </template>
          </q-field>
          <div class="col scroll">
            <q-list separator>
              <q-item v-for="{ objKey, errMsg }, i in appStatus.uploadFails" :key="`failItem${i}`">
                <q-item-section>
                  <q-item-label>{{ objKey }}</q-item-label>
                  <q-item-label class="text-red text-italic" caption>{{ `Error: ${errMsg}` }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn v-if="uploadingReqStatus !== 'processing'" glossy push label="Close" color="grey-8" no-caps
          v-close-popup />
        <q-btn v-if="uploadingReqStatus === 'ready' && !appStatus.uploadFails.length" glossy push label="Upload"
          color="primary" no-caps @click="uploadObjs" />
        <q-btn v-if="appStatus.uploadFails.length && uploadingReqStatus === 'processed'" glossy push label="Retry"
          color="amber-8" no-caps />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useAppStatusStore } from 'src/stores/appStatus';
import { useS3ObjectStore } from 'src/stores/s3Object';
import { useAlertHandlerStore } from 'src/stores/alertHandler';
import { computed, onMounted, ref } from 'vue';

const appStatus = useAppStatusStore();
const s3Object = useS3ObjectStore();
const { makeAlert } = useAlertHandlerStore();

const isUploading = ref(false);
const uploadingReqStatus = ref('ready');

const UPLOAD_LIMIT = 50;
let uploadFolders = [];
let uploadFiles = {};

const filter = ref('');
const uploadingTree = ref(null);

const uploadingAmount = ref(1);
const curProcessPercentage = computed(() => (
  Number((appStatus.latestProcessingNum / uploadingAmount.value).toFixed(2))
));
const curPercentageText = computed(() => `${Math.floor(curProcessPercentage.value * 100)}%`);

function initStatus() {
  appStatus.latestProcessingNum = 0;
  uploadingReqStatus.value = 'ready';
  appStatus.uploadStatus = {};
  appStatus.uploadFails = [];
  uploadFolders = [];
  uploadFiles = {};
  filter.value = '';
  uploadingTree.value = null;
  uploadingAmount.value = 1;
}

function getFileObj(entry) {
  return new Promise((resolve, reject) => {
    entry.file(
      (file) => {
        if (/[~'%]+/.test(file.name)) {
          reject(new Error(`There are illegal characters of this file ${file.name}`));
        } else resolve(file);
      },
      (err) => {
        console.log(err);
        reject('Fail to get file object');
      },
    );
  });
}

function traverseDir(dir) {
  const folderReader = dir.createReader();

  return new Promise((resolve, reject) => {
    const folders = [];
    const files = [];
    let isEmptyFolder = true;
    const getEntries = () => {
      folderReader.readEntries(
        (entries) => {
          if (entries.length) {
            isEmptyFolder = false;
            entries.forEach((entry) => {
              if (entry.isFile) files.push(entry);
              else folders.push(entry);
            });
            getEntries();
          } else {
            if (isEmptyFolder) {
              const dirPrefix = s3Object.curDirectory === '/' ? '' : s3Object.curDirectory;
              uploadFolders.push(`${dirPrefix}${dir.fullPath}/`.slice(1));
              // uploadFolders[dir.fullPath] = `${dirPrefix}${dir.fullPath}/`.slice(1);
            }
            resolve({ folders, files });
          }
        },
        (err) => { reject(err); },
      );
    };

    getEntries();
  });
}

async function gatherUploadInfos(dropItems) {
  const folders = [];
  const files = [];

  dropItems.forEach((item) => {
    if (item.isFile) files.push(item);
    else folders.push(item);
  });
  do {
    if (folders.length) {
      const result = await traverseDir(folders[0]);

      result.folders.forEach((f) => folders.push(f));
      result.files.forEach((f) => files.push(f));
      folders.shift();
    }
  } while (folders.length);

  const reqUploadingAmount = folders.length + files.length;

  if (reqUploadingAmount > UPLOAD_LIMIT) {
    throw new Error(`The number of uploading request (${reqUploadingAmount}) should not exceed ${UPLOAD_LIMIT}`);
  }

  const processFilesResults = await Promise.allSettled(files.map((file) => getFileObj(file)));

  processFilesResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const dirPrefix = s3Object.curDirectory === '/' ? '' : s3Object.curDirectory;
      uploadFiles[`${dirPrefix}${files[index].fullPath}`.slice(1)] = result.value;
    } else {
      appStatus.uploadFails.push({
        objKey: files[index].fullPath,
        errMsg: result.reason,
      });
    }
  });
  uploadingAmount.value = uploadFolders.length + Object.keys(uploadFiles).length;
}

function structureDropItems(dropList) {
  return dropList.reduce((result, obj) => {
    const dirKeys = obj.split('/').filter((e) => e !== '');

    dirKeys.forEach((key, index) => {
      const isFile = (index === dirKeys.length - 1) && obj[obj.length - 1] !== '/';
      const objDir = dirKeys.slice(0, index).join('/');
      const objPath = `${objDir ? `${objDir}/` : ''}${key}`;

      (result[objDir] ??= {})[objPath] = {
        label: key,
        icon: isFile ? 'fa-regular fa-file' : 'fa-solid fa-folder',
        type: isFile ? 'file' : 'folder',
        objKey: `${objPath}${isFile ? '' : '/'}`,
      };
    });

    appStatus.uploadStatus[obj] = 'ready';
    return result;
  }, {});
}

function getStatusTree(structure) {
  const firstLevelObjs = Object.values(structure)[0];
  const result = Object.values(firstLevelObjs);
  const processLevel = Object.keys(firstLevelObjs)
    .map((objDir, index) => ({ objDir, nodeRef: result[index] }));

  while (processLevel.length) {
    const { objDir, nodeRef } = processLevel.shift();

    if (structure[objDir]) {
      Object.entries(structure[objDir]).forEach(([dir, info]) => {
        const node = { ...info };

        (nodeRef.children ??= []).push(node);
        processLevel.push({ objDir: dir, nodeRef: node });
      });
    }
  }

  return result;
}

async function uploadObjs() {
  const fileKeys = Object.keys(uploadFiles);
  const objKeys = uploadFolders.concat(fileKeys);

  objKeys.forEach((key) => { appStatus.uploadStatus[key] = 'processing'; });
  uploadingReqStatus.value = 'processing';

  await Promise.allSettled([
    s3Object.createObject('folder', uploadFolders),
    s3Object.createObject('files', Object.keys(uploadFiles), uploadFiles),
  ]);
  await s3Object.getBucketStructure();
  appStatus.refreshList = appStatus.refreshList.concat(fileKeys.map((key) => `/${encodeURI(key)}`));
  uploadingReqStatus.value = 'processed';
}

async function checkUploading(dropItems) {
  initStatus();
  try {
    await gatherUploadInfos(dropItems);

    const statusStructure = structureDropItems([
      ...uploadFolders,
      ...Object.keys(uploadFiles),
      ...appStatus.uploadFails.map((f) => `${s3Object.curDirectory === '/' ? '' : s3Object.curDirectory}${f.objKey}`)]);

    uploadingTree.value = getStatusTree(statusStructure);
  } catch (err) {
    makeAlert('error', 'checkUploading', err.message);
    isUploading.value = false;
  }
}

onMounted(() => {
  const dropArea = document.getElementById('/');

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    dropArea.addEventListener(eventName, async (e) => {
      e.preventDefault();

      if (eventName === 'dragenter' || eventName === 'dragover') {
        dropArea.classList.add('dropArea', 'dropIn');
      } else {
        dropArea.classList.remove('dropArea', 'dropIn');
        if (eventName === 'drop') {
          isUploading.value = true;
          const requirements = [];

          for (let i = 0; i < e.dataTransfer.items.length; i++) {
            requirements.push(
              e.dataTransfer.items[i].webkitGetAsEntry()
              || e.dataTransfer.items[i].getAsEntry(),
            );
          }

          await checkUploading(requirements);
        }
      }
    });
  });
});

</script>

<style>
.dropArea {
  border: none !important;
  background: linear-gradient(90deg, gray 50%, transparent 50%),
    linear-gradient(90deg, gray 50%, transparent 50%),
    linear-gradient(0deg, gray 50%, transparent 50%),
    linear-gradient(0deg, gray 50%, transparent 50%);
  background-repeat: repeat-x, repeat-x, repeat-y, repeat-y;
  background-size: 15px 5px, 15px 5px, 5px 15px, 5px 15px;
  background-position: 0 0, 0 100%, 0 0, 100% 0;
}

.dropArea.dropIn {
  animation: borderAnime 15s linear infinite;
}

@keyframes borderAnime {
  100% {
    background-position: 100% 0, -100% 100%, 0 -300%, 100% 300%;
  }
}
</style>
