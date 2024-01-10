import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { Dialog } from 'quasar';
import axios from 'axios';
import { useAlertHandlerStore } from './alertHandler';
import { useAppStatusStore } from './appStatus';
import { usePermissionStore } from './permission';

export const useS3ObjectStore = defineStore('s3Object', () => {
  const { makeAlert } = useAlertHandlerStore();
  const appStatus = useAppStatusStore();
  const permission = usePermissionStore();

  const svrUrl = process.env.API_URL;

  const buckets = ref({});
  const availbleBuckets = ref([]);
  const curBucket = ref(undefined);
  const curDomain = computed(() => buckets.value[curBucket.value]?.domain);
  const curCDNId = computed(() => buckets.value[curBucket.value]?.cdnID);

  const bucketStructure = ref({});
  const curDirectory = ref('/');
  const prevDirectory = ref('/');
  const objsInCurDir = ref([]);
  const subDirsInCurDir = computed(() => {
    if (curDirectory.value === '/') return [['', '/']];

    const pathKeys = curDirectory.value.split('/');

    return pathKeys.map((pathKey, index) => ([
      pathKey, pathKeys.slice(0, index + 1).join('/') || '/',
    ]));
  });

  async function listAllBuckets() {
    try {
      return (await axios.get(
        `${svrUrl}/s3Buckets`,
        { headers: { Authorization: `Bearer ${permission.token}` } },
      )).data.data;
    } catch (err) {
      makeAlert('error', 'listAllBuckets', 'Fail to get all buckets', err);
      return [];
    }
  }

  async function getBucketsInfo() {
    try {
      return (await axios.get(
        `${svrUrl}/s3Buckets/infos`,
        { headers: { Authorization: `Bearer ${permission.token}` } },
      )).data.data;
    } catch (err) {
      makeAlert('error', 'getBucketsInfo', 'Fail to get buckets info', err);
      return {};
    }
  }

  async function getBucketStructure() {
    try {
      return (await axios.get(
        `${svrUrl}/s3Buckets/${curBucket.value}/objects?type=structure`,
        { headers: { Authorization: `Bearer ${permission.token}` } },
      )).data;
    } catch (err) {
      makeAlert('error', 'getBucketStructure', 'Fail to get folder structure', err);
      return null;
    }
  }

  function initBucketsStatus() {
    if (!permission.userInfo.isAdmin) availbleBuckets.value = permission.userInfo.bucketScope;
    curBucket.value = permission.userInfo.isAdmin
      ? process.env.DEFAULT_BUCKET
      : permission.userInfo.bucketScope[0];
    getBucketsInfo().then((val) => {
      buckets.value = val;
      if (permission.userInfo.isAdmin) availbleBuckets.value = Object.keys(val);
    });
  }

  function execDownload(urls, names) {
    for (let i = 0; i < urls.length; i++) {
      if (window.confirm(`Want to download the file ${names[i]}?`)) {
        const dummyLink = document.createElement('a');
        dummyLink.setAttribute('href', urls[i]);
        dummyLink.setAttribute('download', names[i]);
        dummyLink.click();
        dummyLink.remove();
      }
    }
  }

  async function downloadFiles() {
    try {
      const fileNames = [];
      const reqKeys = appStatus.selections
        .map((ele) => {
          fileNames.push(ele.id.split('/').slice(-1)[0]);
          return encodeURI(ele.id.slice(1));
        })
        .join(',');

      const downloadUrls = (await axios.get(
        `${svrUrl}/s3Buckets/${curBucket.value}/objects?type=file&reqList=${reqKeys}`,
        { headers: { Authorization: `Bearer ${permission.token}` } },
      )).data;

      execDownload(downloadUrls, fileNames);
    } catch (err) {
      makeAlert('error', 'downloadFiles', 'Fail to download the files', err);
    }
  }

  async function processUpload(objInfo, objVal) {
    const form = new FormData();

    Object.entries(objInfo.fields).forEach(([prop, val]) => {
      form.append(prop, val);
    });
    form.append('file', objVal);

    try {
      await axios.post(objInfo.url, form);
      appStatus.lastProcessObj = objInfo.fields.key;
      appStatus.lastProcessNum++;
      return objInfo.fields.key;
    } catch {
      throw new Error(objInfo.fields.key);
    }
  }

  async function uploadObject(objType, objKeys, objVals, isPublic) {
    try {
      const { objInfos, failedKeys } = (await axios.put(
        `${svrUrl}/s3Buckets/${curBucket.value}/objects?type=${objType}`,
        { objKeys, ...(objType === 'file' && { isPublic }) },
        { headers: { Authorization: `Bearer ${permission.token}` } },
      )).data;

      if (objType === 'file') {
        const results = await Promise.allSettled(objInfos.map((objInfo) => (
          processUpload(objInfo, objVals[objInfo.fields.key])
        )));

        results.forEach((result) => {
          if (result.status === 'rejected') failedKeys.push(result.reason);
        });
      }

      if (failedKeys.length) {
        makeAlert('error', `uploadObject(${objType})`, 'Some objects fail to create', new Error(`Failure: ${failedKeys.join(',')}`));
      }
    } catch (err) {
      makeAlert('error', `uploadObject(${objType})`, 'Fail to create object', err);
    }
  }

  function updateLastKeyPart(oriKey, replacement) {
    return oriKey.replace(
      oriKey.split('/')[0].split('.')[0],
      replacement,
    );
  }

  function getModifications(type, reqList, newName) {
    const base = type === 'rename'
      ? `${curDirectory.value}/`
      : `/${reqList[0].slice(1).split('/').slice(0, -1).join('/')}/`;

    return reqList.reduce((result, objId, index) => {
      const replaceKey = type === 'rename'
        ? `${newName}${index > 0 ? ` (${index})` : ''}`
        : '';
      let lastPartKey;
      const processList = [objId];

      while (processList.length) {
        const objDir = processList.shift();

        if (!bucketStructure.value[objDir]) {
          [, lastPartKey] = objDir.split(base);
          const dirEndChar = document.getElementById(objDir).classList.contains('isDir') ? '/' : '';
          // lastPartKey.split('.').length > 1 ? '' : '/';

          result.push({
            oriKey: objDir.slice(1),
            newKey: type === 'rename'
              ? `${base}${updateLastKeyPart(lastPartKey, replaceKey)}${dirEndChar}`.slice(1)
              : `${curDirectory.value}${lastPartKey}${dirEndChar}`.slice(1),
          });
        } else {
          Object.keys(bucketStructure.value[objDir]).forEach((subObj) => {
            processList.push(subObj);
          });
        }
      }
      return result;
    }, []);
  }

  async function modifyObject(type, reqList, newName) {
    try {
      const { failure } = (await axios.patch(
        `${svrUrl}/s3Buckets/${curBucket.value}/objects/infos`,
        getModifications(type, reqList, newName),
        { headers: { Authorization: `Bearer ${permission.token}` } },
      )).data;

      if (failure.length) {
        makeAlert('err', `modifyObject(${type})`, `Some objects fail to ${type}: ${failure.join(',')}`, new Error(`Failed: ${failure.join(',')}`));
      } else {
        makeAlert('info', `modifyObject(${type})`, `All objects success to ${type}`);
      }
    } catch (err) {
      makeAlert('error', `modifyObject(${type})`, `Fail to ${type} the objects`, err);
    }
  }

  function deleteObject() {
    let dialogContent = `<hr class="q-separator q-separator--horizontal">
    <div class="text-h6 q-my-md">Object list: </div>
    <div class="q-px-sm q-mb-md" style="height:70vh;overflow:auto;border:3px inset lightgray">`;
    const reqList = appStatus.selections.map((selected) => ({
      Key: `${selected.id.slice(1)}${selected.classList.contains('isDir') ? '/' : ''}`,
    }));

    appStatus.selections.forEach((selected, index) => {
      dialogContent += `<div class="text-subtitle1 text-indigo" style="white-space: nowrap;">🔹 <i>${selected.id}</i></div>`;
      if (index === appStatus.selections.length - 1) dialogContent += '</div>';
    });

    Dialog.create({
      title: '<div class="text-h5 text-red text-bold">Delete objecs</div>',
      message: dialogContent,
      ok: {
        label: 'Confirm',
        push: true,
        color: 'primary',
      },
      cancel: {
        label: 'Cancel',
        push: true,
        color: 'grey-8',
      },
      maximized: true,
      html: true,
    })
      .onOk(async () => {
        appStatus.isProcessing = true;
        try {
          const { success, failure } = (await axios.delete(
            `${svrUrl}/s3Buckets/${curBucket.value}/objects`,
            reqList,
            { headers: { Authorization: `Bearer ${permission.token}` } },
          )).data;

          if (failure.length) {
            makeAlert('error', 'deleteObject', `Some objects fail to delete: ${failure.join(',')}`, new Error(`Failed: ${failure.join(',')}`));
          } else {
            makeAlert('info', 'deleteObject', 'Success to delete the objects');
            appStatus.restoreList = success;
            getBucketStructure().then((val) => { bucketStructure.value = val; });
          }
        } catch (err) {
          makeAlert('error', 'deleteObject', 'Fail to delete the objects', err);
        }
        appStatus.isProcessing = false;
      });
  }

  async function getObjVersions() {
    try {
      const isFile = appStatus.selections[0].classList.contains('isFile');
      const objKey = `${appStatus.selections[0].id.slice(1)}${isFile ? '' : '/'}`;

      appStatus.curObjVerList = (await axios.get(
        `${svrUrl}/s3Buckets/${curBucket.value}/objects?type=versions&objKey=${objKey}`,
        { headers: { Authorization: `Bearer ${permission.token}` } },
      )).data.data.objVerInfos;
    } catch (err) {
      makeAlert('error', 'getObjVersions', 'Fail to get the object\'s version', err);
    }
  }

  async function changeObjVersion() {
    try {
      const { verId } = appStatus.curObjVerList[appStatus.newObjVerIndex];
      const key = appStatus.selections[0].id.slice(1);
      const isPublic = Boolean(curCDNId.value);

      await axios.patch(
        `${svrUrl}/s3Buckets/${curBucket.value}/object/version?verId=${verId}&key=${key}&isPublic=${isPublic}`,
        { headers: { Authorization: `Bearer ${permission.token}` } },
      );
      makeAlert('info', 'changeObjVersion', 'Success to change object into specific version');
    } catch (err) {
      makeAlert('error', 'changeObjVersion', 'Fail to change the object by version', err);
    }
  }

  async function refreshCDN() {
    appStatus.isProcessing = true;
    appStatus.refreshList = Array.from(new Set(appStatus.refreshList));
    try {
      await axios.patch(
        `${svrUrl}/s3Buckets/distributions`,
        {
          DistributionId: curCDNId.value,
          Items: appStatus.refreshList.length ? appStatus.refreshList : [encodeURI(`${curDirectory.value}/*`)],
        },
        { headers: { Authorization: `Bearer ${permission.token}` } },
      );

      makeAlert('info', 'refreshCDN', 'Success to send refresh request');
    } catch (err) {
      makeAlert('error', 'refreshCDN', 'Fail to refresh S3 distributions', err);
    }

    appStatus.isProcessing = false;
  }

  async function restoreDeletedObj() {
    try {
      const { failure } = (await axios.patch(
        `${svrUrl}/s3Buckets/${curBucket.value}/objects/existence`,
        { reqList: appStatus.restoreList },
        { headers: { Authorization: `Bearer ${permission.token}` } },
      )).data.data;

      if (failure.length) {
        const failKeys = failure.map((f) => f.key);

        makeAlert(
          'error',
          'restoreDeletedObj',
          `Fail to restore the objects: ${failKeys.join(',')}`,
          failure.map(({ key, reason }) => `${key}: ${reason}`).join('\n'),
        );
        appStatus.restoreList = failKeys;
      } else {
        appStatus.restoreList = [];
        makeAlert('info', 'restoreDeletedObj', 'Success to restore the objects');
      }
    } catch (err) {
      makeAlert('error', 'restoreDeletedObj', 'Fail to restore the object', err);
    }
  }

  watch(() => permission.token, initBucketsStatus);

  watch([bucketStructure, curDirectory], () => {
    const curDirObjsInfo = Object.entries(bucketStructure.value[curDirectory.value] || {});
    const folders = [];
    const files = [];
    const result = [];

    curDirObjsInfo.forEach((objInfo) => {
      if (objInfo[1].isFile && objInfo[0] !== '/error.html') files.push(objInfo);
      else if (!objInfo[1].isFile) folders.push(objInfo);
    });

    folders.sort((a, b) => a[0].localeCompare(b[0]));
    folders.forEach((folder) => { result.push(folder); });
    files.sort((a, b) => a[0].localeCompare(b[0]));
    files.forEach((file) => { result.push(file); });
    objsInCurDir.value = result;
  }, { deep: true });

  watch(curBucket, () => {
    getBucketStructure().then((structure) => { bucketStructure.value = structure; });
  });

  if (permission.token) {
    initBucketsStatus();
  }

  return {
    svrUrl,
    buckets,
    availbleBuckets,
    curBucket,
    curDomain,
    curCDNId,
    bucketStructure,
    curDirectory,
    prevDirectory,
    objsInCurDir,
    subDirsInCurDir,
    listAllBuckets,
    getBucketStructure,
    downloadFiles,
    uploadObject,
    modifyObject,
    deleteObject,
    getObjVersions,
    changeObjVersion,
    refreshCDN,
    restoreDeletedObj,
  };
});