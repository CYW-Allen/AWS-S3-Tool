import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { Dialog } from 'quasar';
import axios from 'axios';
import dayjs from 'dayjs';
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
      makeAlert('error', 'listAllBuckets', 'Fail to get all buckets', err?.response?.data?.message || err.message);
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
      makeAlert('error', 'getBucketsInfo', 'Fail to get buckets info', err?.response?.data?.message || err.message);
      return {};
    }
  }

  async function getBucketStructure() {
    try {
      appStatus.dragSelect?.clearSelection(true);
      bucketStructure.value = (await axios.get(
        `${svrUrl}/s3Buckets/${curBucket.value}/objects?type=structure`,
        { headers: { Authorization: `Bearer ${permission.token}` } },
      )).data.data;
    } catch (err) {
      makeAlert('error', 'getBucketStructure', 'Fail to get folder structure', err?.response?.data?.message || err.message);
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
          fileNames.push(ele.split('/').slice(-1)[0]);
          return encodeURI(ele.slice(1));
        })
        .join(',');

      const { fileUrls, failedKeys } = (await axios.get(
        `${svrUrl}/s3Buckets/${curBucket.value}/objects?type=file&reqList=${reqKeys}`,
        { headers: { Authorization: `Bearer ${permission.token}` } },
      )).data.data;

      execDownload(fileUrls, fileNames);
      if (failedKeys.length) {
        makeAlert('error', 'downloadFiles', `Fail to download object: ${failedKeys.join(',')}`);
      }
    } catch (err) {
      makeAlert('error', 'downloadFiles', 'Fail to download the files', err?.response?.data?.message || err.message);
    }
  }

  async function createFolder(objKey) {
    try {
      await axios.put(
        `${svrUrl}/s3Buckets/${curBucket.value}/objects?type=folder`,
        { objKeys: [objKey] },
        { headers: { Authorization: `Bearer ${permission.token}` } },
      );
      appStatus.uploadStatus[objKey] = 'success';
      appStatus.latestProcessingNum++;
    } catch (err) {
      appStatus.latestProcessingNum++;
      appStatus.uploadStatus[objKey] = 'fail';
      console.log('[createFolder] Error: ', err?.response?.data?.message || err.message);
      throw new Error(objKey);
    }
  }

  async function addHistory(operInfo) {
    try {
      await axios.put(
        `${svrUrl}/s3History/${curBucket.value}`,
        operInfo,
        { headers: { Authorization: `Bearer ${permission.token}` } },
      );
      makeAlert('info', 'addHistory', 'Success to add history');
    } catch (err) {
      makeAlert('error', 'addHistory', 'Fail to add history', err?.response?.data?.message || err.message);
    }
  }

  async function uploadFile(objInfo, objVal) {
    const form = new FormData();

    Object.entries(objInfo.fields).forEach(([prop, val]) => {
      form.append(prop, val);
    });
    form.append('file', objVal);

    try {
      await axios.post(objInfo.url, form);
      await addHistory({
        bucket: curBucket.value,
        objKey: objInfo.fields.key,
        action: 'upload',
        editor: permission.userInfo.username,
        createdTimeNum: dayjs().format('YYYYMMDD'),
      });
      appStatus.latestProcessingNum++;
      appStatus.uploadStatus[objInfo.fields.key] = 'success';
    } catch (err) {
      console.log('[uploadFile] Error: ', err?.response?.data?.message || err.message);
      appStatus.latestProcessingNum++;
      appStatus.uploadStatus[objInfo.fields.key] = 'fail';
      appStatus.uploadFails.push({
        objKey: objInfo.fields.key,
        errMsg: 'Fail to upload the file',
      });
    }
  }

  async function createObject(objType, objKeys, objVals) {
    try {
      if (objType === 'folder') {
        await Promise.allSettled(objKeys.map((key) => createFolder(key)));
      } else {
        const { success, failure } = (await axios.put(
          `${svrUrl}/s3Buckets/${curBucket.value}/objects?type=file`,
          { objKeys, isPublic: Boolean(curCDNId.value) },
          { headers: { Authorization: `Bearer ${permission.token}` } },
        )).data.data;

        failure.forEach((failKey) => {
          appStatus.latestProcessingNum++;
          appStatus.uploadStatus[failKey] = 'fail';
          appStatus.uploadFails.push({
            objKey: failKey,
            errMsg: 'Fail to get uploading infos',
          });
        });

        await Promise.allSettled(success.map((objInfo) => (
          uploadFile(objInfo, objVals[objInfo.fields.key])
        )));
        makeAlert('info', `createObject(${objType})`, 'Finish to upload objects');
      }
    } catch (err) {
      makeAlert('error', `createObject(${objType})`, err?.response?.data?.message || err.message);
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
      : type === 'paste'
        ? `${reqList[0].split('/').slice(0, -1).join('/')}/`
        : '';

    return reqList.reduce((result, objId, index) => {
      const replaceKey = type === 'rename' ? `${newName} (${index + 1})` : '';
      let lastPartKey;
      const processList = [objId];

      while (processList.length) {
        const objDir = processList.shift();

        if (!bucketStructure.value[objDir]) {
          const parent = objDir.split('/').slice(0, -1).join('/') || '/';
          const dirEndChar = bucketStructure.value[parent][objDir].isFile ? '' : '/';
          const oriKeyStr = `${objDir}${dirEndChar}`;

          if (dirEndChar !== '/') appStatus.refreshList.push(encodeURI(oriKeyStr));
          if (type === 'delete') {
            result.push({ Key: oriKeyStr.slice(1) });
          } else {
            [, lastPartKey] = objDir.split(base);
            result.push({
              oriKey: oriKeyStr.slice(1),
              newKey: type === 'rename'
                ? `${base}${updateLastKeyPart(lastPartKey, replaceKey)}${dirEndChar}`.slice(1)
                : `${curDirectory.value === '/' ? '' : curDirectory.value}/${lastPartKey}${dirEndChar}`.slice(1),
            });
          }
        } else {
          if (type === 'delete') {
            result.push({ Key: `${objDir}/`.slice(1) });
          }
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
        { items: getModifications(type, reqList, newName), isPublic: Boolean(curCDNId) },
        { headers: { Authorization: `Bearer ${permission.token}` } },
      )).data.data;

      if (failure.length) {
        makeAlert('err', `modifyObject(${type})`, `Some objects fail to ${type}: ${failure.join(',')}`);
      } else {
        makeAlert('info', `modifyObject(${type})`, `All objects success to ${type}`);
      }
      await getBucketStructure();
    } catch (err) {
      makeAlert('error', `modifyObject(${type})`, err?.response?.data?.message || err.message);
    }
  }

  function deleteObject() {
    let dialogContent = `<hr class="q-separator q-separator--horizontal">
    <div class="text-h6 q-my-md">Object list: </div>
    <div class="q-px-sm q-mb-md" style="height:70vh;overflow:auto;border:3px inset lightgray">`;
    const reqList = getModifications('delete', appStatus.selections);

    reqList.forEach((reqObj, index) => {
      dialogContent += `<div class="text-subtitle1 text-indigo" style="white-space: nowrap;">🔹 <i>${reqObj.Key}</i></div>`;
      if (index === reqList.length - 1) dialogContent += '</div>';
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
            {
              headers: { Authorization: `Bearer ${permission.token}` },
              data: reqList,
            },
          )).data.data;

          if (failure.length) {
            makeAlert('error', 'deleteObject', `Some objects fail to delete: ${failure.join(',')}`);
          } else {
            makeAlert('info', 'deleteObject', 'Success to delete the objects');
          }
          await getBucketStructure();
          appStatus.restoreList = success;
        } catch (err) {
          makeAlert('error', 'deleteObject', err?.response?.data?.message || err.message);
        }
        appStatus.isProcessing = false;
      });
  }

  async function getObjVersions() {
    const { isFile } = bucketStructure.value[curDirectory.value][appStatus.selections[0]];

    if (!isFile) makeAlert('error', 'getObjVersions', 'Only file object is versioned');
    else {
      const objKey = appStatus.selections[0].slice(1);

      try {
        appStatus.curObjVerList = (await axios.get(
          `${svrUrl}/s3Buckets/${curBucket.value}/objects?type=versions&objKey=${objKey}`,
          { headers: { Authorization: `Bearer ${permission.token}` } },
        )).data.data.objVerInfos;
      } catch (err) {
        makeAlert('error', 'getObjVersions', err?.response?.data?.message || err.message);
      }
    }
  }

  async function changeObjVersion() {
    try {
      const { verId } = appStatus.curObjVerList[appStatus.newObjVerIndex];
      const key = appStatus.selections[0].slice(1);
      const isPublic = Boolean(curCDNId.value);

      await axios.patch(
        `${svrUrl}/s3Buckets/${curBucket.value}/object/version?verId=${verId}&key=${key}&isPublic=${isPublic}`,
        {},
        { headers: { Authorization: `Bearer ${permission.token}` } },
      );
      appStatus.refreshList.push(encodeURI(appStatus.selections[0]));
      makeAlert('info', 'changeObjVersion', 'Success to change object into specific version');
    } catch (err) {
      makeAlert('error', 'changeObjVersion', err?.response?.data?.message || err.message);
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
      appStatus.refreshList = [];
      makeAlert('info', 'refreshCDN', 'Success to send refresh request');
    } catch (err) {
      makeAlert('error', 'refreshCDN', err?.response?.data?.message || err.message);
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
        makeAlert('error', 'restoreDeletedObj', `Fail to restore the objects: ${failure.join(',')}`);
        appStatus.restoreList = failure;
      } else {
        makeAlert('info', 'restoreDeletedObj', 'Success to restore the objects');
        appStatus.restoreList = [];
      }
    } catch (err) {
      makeAlert('error', 'restoreDeletedObj', err?.response?.data?.message || err.message);
    }
  }

  watch(() => permission.token, (v) => {
    if (v) initBucketsStatus();
  });

  watch(curBucket, async () => {
    appStatus.isProcessing = true;
    appStatus.preStep = [];
    appStatus.nextStep = [];
    await getBucketStructure();
    curDirectory.value = '/';
    appStatus.isProcessing = false;
  });

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

  if (permission.token) {
    if (permission.userInfo.exp > dayjs().unix()) initBucketsStatus();
    else {
      window.localStorage.removeItem('token');
      permission.token = null;
    }
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
    objsInCurDir,
    subDirsInCurDir,
    listAllBuckets,
    getBucketStructure,
    downloadFiles,
    createObject,
    modifyObject,
    deleteObject,
    getObjVersions,
    changeObjVersion,
    refreshCDN,
    restoreDeletedObj,
    addHistory,
  };
});
