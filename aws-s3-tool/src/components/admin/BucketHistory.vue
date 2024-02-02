<template>
  <q-dialog v-model="appStatus.showBucketHistory" persistent maximized>
    <div class="fit column bg-white">
      <q-bar class="glossy">
        <div class="text-bold">Bucket History</div>
        <q-space />
        <q-btn dense flat icon="fa-solid fa-xmark" v-close-popup>
          <q-tooltip class="bg-white text-primary">Close</q-tooltip>
        </q-btn>
      </q-bar>

      <div class="col q-pa-md bg-light-blue-1 column">
        <div class="col-3">
          <q-splitter class="full-height" :model-value="5" :limits="[5, 5]">
            <template v-slot:before>
              <q-tabs :class="`${permission?.userInfo?.isAdmin ? 'adminOperationTabs' : 'userOperationTabs'} bg-blue-3`"
                v-model="operation" vertical>
                <q-tab name="Query" label="Query" icon="fa-solid fa-magnifying-glass" no-caps />
                <q-tab v-if="permission?.userInfo?.isAdmin" name="Edit" label="Edit" icon="fa-solid fa-pen-to-square"
                  no-caps />
              </q-tabs>
            </template>

            <template v-slot:after>
              <div class="fit row" style="border: 3px groove #90caf9;">
                <q-tab-panels class="fit col bg-transparent" v-model="operation" animated transition-prev="slide-down"
                  transition-next="slide-up">
                  <q-tab-panel name="Query" class="q-pa-none">
                    <q-form class="fit row wrap" id="queryHistoryForm" @submit="getHistory">
                      <div class="q-ma-none q-px-lg full-height col-4 q-gutter-y-sm" style="min-width: 300px;">
                        <div class="text-h6 text-bold">Condition:</div>
                        <q-select class="text-subtitle1 text-bold ellipsis" input-class="ellipsis" filled
                          v-model="queryCondition.bucket" :options="bucketList" square dense>
                          <template v-slot:prepend>
                            <div class="text-subtitle1 text-bold">Bucket : </div>
                          </template>
                        </q-select>
                        <q-select class="text-subtitle1 text-bold" input-class="ellipsis" filled
                          v-model="queryCondition.mainObj" :options="queryObjs" @update:model-value="resetCondObjVal"
                          square dense>
                          <template v-slot:prepend>
                            <div class="text-subtitle1 text-bold">Object : </div>
                          </template>
                        </q-select>
                        <q-select v-if="queryCondition.mainObj === 'action'" class="text-subtitle1 text-bold" filled
                          square v-model="queryCondition.objVal" :options="actionList" dense>
                          <template v-slot:prepend>
                            <div class="text-subtitle1 text-bold">Value : </div>
                          </template>
                        </q-select>
                        <q-input v-else-if="queryCondition.mainObj === 'createdTimeNum'"
                          input-class="text-subtitle1 cursor-pointer ellipsis" v-model="displayPickupTime"
                          @click="timePicker.show()" readonly filled square dense>
                          <template v-slot:prepend>
                            <div class="text-subtitle1 text-bold ellipsis">
                              Value :
                            </div>
                          </template>
                          <template v-slot:append>
                            <q-icon name="fa-solid fa-calendar-day" class="cursor-pointer">
                              <q-popup-proxy ref="timePicker" cover transition-show="scale" transition-hide="scale">
                                <q-date v-model="queryCondition.objVal" mask="YYYYMMDD" range>
                                  <div class="row items-center justify-end">
                                    <q-btn v-close-popup class="text-subtitle1" label="Close" color="primary" flat />
                                  </div>
                                </q-date>
                              </q-popup-proxy>
                            </q-icon>
                          </template>
                        </q-input>
                        <q-input v-else input-class="text-subtitle1 text-bold" filled square
                          v-model="queryCondition.objVal" dense lazy-rules
                          :rules="[(val) => val.length || alertValidateFail('Value must not be empty')]"
                          hide-bottom-space>
                          <template v-slot:prepend>
                            <div class="text-subtitle1 text-bold">Value : </div>
                          </template>
                        </q-input>
                      </div>

                      <div class="q-ma-none q-px-lg full-height col-8 q-gutter-y-sm">
                        <div class="text-h6 text-bold">
                          <span class="q-mr-md">Filters: </span>
                          <q-btn color="green" icon="fa-solid fa-plus" size="xs" push round glossy
                            :disable="filters.length === 3" @click="addFilter" />
                        </div>
                        <div class="row justify-start items-center q-gutter-x-sm" v-for="filter, i in filters"
                          :key="`filter${i}`">
                          <q-select class="text-subtitle1 text-bold col-4" filled v-model="filter.mainObj"
                            :options="filterObjs" @update:model-value="resetFilterObjVal(i)" hide-bottom-space square
                            dense lazy-rules
                            :rules="[(val) => checkRedundantFilter(val) || alertValidateFail('Redundant config')]">
                            <template v-slot:prepend>
                              <div class="text-subtitle1 text-bold">Object : </div>
                            </template>
                          </q-select>
                          <q-select v-if="filter.mainObj === 'action'" class="text-subtitle1 text-bold col-5" filled
                            square v-model="filter.objVal" :options="actionList" dense>
                            <template v-slot:prepend>
                              <div class="text-subtitle1 text-bold">Value : </div>
                            </template>
                          </q-select>
                          <q-input v-else class="col-5" input-class="text-subtitle1 text-bold" filled square
                            v-model="filter.objVal" dense hide-bottom-space lazy-rules
                            :rules="[(val) => val.length || alertValidateFail('Value must not be empty')]">
                            <template v-slot:prepend>
                              <div class="text-subtitle1 text-bold">Value : </div>
                            </template>
                          </q-input>
                          <q-btn size="xs" color="grey-8" icon="fa-solid fa-xmark" round push glossy
                            @click="removeFilter(i)" />
                        </div>
                      </div>
                    </q-form>
                  </q-tab-panel>
                  <q-tab-panel name="Edit" class="q-pa-none">
                    <q-option-group v-model="editMode" class="text-h6" color="primary" inline
                      :options="[{ label: 'Delete', value: 'delete' }, { label: 'Add', value: 'add' }]" />
                    <q-tab-panels v-model="editMode" class="bg-transparent" animated>
                      <q-tab-panel name="delete">
                        <q-form class="fit column" id="deleteHistoryForm" @submit="deleteHistory">
                          <div class="row justify-start items-center q-gutter-x- text-subtitle1">
                            <q-radio v-model="deleteMode" checked-icon="fa-regular fa-circle-check"
                              unchecked-icon="fa-regular fa-circle" val="condition" label="By condition" />
                            <q-radio v-model="deleteMode" checked-icon="fa-regular fa-circle-check"
                              unchecked-icon="fa-regular fa-circle" val="selection" label="By selection"
                              :disable="!selectedRows.length" />
                          </div>

                          <div v-if="deleteMode === 'condition'"
                            class="q-pl-md row justify-start items-center q-gutter-x-sm">
                            <q-select class="text-subtitle1 text-bold" input-class="ellipsis" filled
                              v-model="deleteCondition.obj" :options="deleteObjs" @update:model-value="resetDeleteObjVal"
                              square dense>
                              <template v-slot:prepend>
                                <div class="text-subtitle1 text-bold">Object : </div>
                              </template>
                            </q-select>
                            <q-select v-if="deleteCondition.obj === 'action'" class="text-subtitle1 text-bold" filled
                              square v-model="deleteCondition.objVal" :options="actionList" dense>
                              <template v-slot:prepend>
                                <div class="text-subtitle1 text-bold">Value : </div>
                              </template>
                            </q-select>
                            <q-select v-else-if="deleteCondition.obj === 'bucket'" class="text-subtitle1 text-bold" filled
                              square v-model="deleteCondition.objVal" :options="s3Object.availbleBuckets" dense>
                              <template v-slot:prepend>
                                <div class="text-subtitle1 text-bold">Value : </div>
                              </template>
                            </q-select>
                            <q-input v-else-if="deleteCondition.obj === 'createdTimeNum'"
                              input-class="text-subtitle1 cursor-pointer ellipsis" v-model="displayDelPickupTime"
                              @click="delTimePicker.show()" readonly filled square dense>
                              <template v-slot:prepend>
                                <div class="text-subtitle1 text-bold ellipsis">
                                  Value :
                                </div>
                              </template>
                              <template v-slot:append>
                                <q-icon name="fa-solid fa-calendar-day" class="cursor-pointer">
                                  <q-popup-proxy ref="delTimePicker" cover transition-show="scale"
                                    transition-hide="scale">
                                    <q-date v-model="deleteCondition.objVal" mask="YYYYMMDD" range>
                                      <div class="row items-center justify-end">
                                        <q-btn v-close-popup class="text-subtitle1" label="Close" color="primary" flat />
                                      </div>
                                    </q-date>
                                  </q-popup-proxy>
                                </q-icon>
                              </template>
                            </q-input>
                            <q-input v-else input-class="text-subtitle1 text-bold" filled square
                              v-model="deleteCondition.objVal" dense lazy-rules
                              :rules="[(val) => val.length || alertValidateFail('Value must not be empty')]"
                              hide-bottom-space>
                              <template v-slot:prepend>
                                <div class="text-subtitle1 text-bold">Value : </div>
                              </template>
                            </q-input>
                          </div>
                          <div v-else class="text-subtitle1 q-pl-md">
                            <span class="q-mr-sm">Delete the following rows: </span>
                            <span class="q-mr-sm text-red">{{ selectedRows.length }}</span>
                            <span>rows selected</span>
                          </div>
                        </q-form>
                      </q-tab-panel>
                      <q-tab-panel name="add">
                        <q-form class="fit row q-col-gutter-md" id="addHistoryForm" @submit="addHistory">
                          <q-select class="text-subtitle1 text-bold col-4" filled square v-model="addCondition.bucket"
                            :options="s3Object.availbleBuckets" dense>
                            <template v-slot:prepend>
                              <div class="text-subtitle1 text-bold">Bucket : </div>
                            </template>
                          </q-select>
                          <q-select class="text-subtitle1 text-bold col-4" filled square v-model="addCondition.action"
                            :options="actionList" dense>
                            <template v-slot:prepend>
                              <div class="text-subtitle1 text-bold">Action : </div>
                            </template>
                          </q-select>
                          <q-input class="col-4" input-class="text-subtitle1 cursor-pointer ellipsis"
                            :model-value="addCondition.createdTimeNum" @click="addTimePicker.show()" readonly filled
                            square dense>
                            <template v-slot:prepend>
                              <div class="text-subtitle1 text-bold ellipsis">
                                Record time :
                              </div>
                            </template>
                            <template v-slot:append>
                              <q-icon name="fa-solid fa-calendar-day" class="cursor-pointer">
                                <q-popup-proxy ref="addTimePicker" cover transition-show="scale" transition-hide="scale">
                                  <q-date v-model="addCondition.createdTimeNum" mask="YYYYMMDD">
                                    <div class="row items-center justify-end">
                                      <q-btn v-close-popup class="text-subtitle1" label="Close" color="primary" flat />
                                    </div>
                                  </q-date>
                                </q-popup-proxy>
                              </q-icon>
                            </template>
                          </q-input>
                          <q-input class="col-6" input-class="text-subtitle1 text-bold" filled square
                            v-model="addCondition.objKey"
                            :rules="[(val) => val.length || alertValidateFail('Value must not be empty')]" dense
                            lazy-rules hide-bottom-space>
                            <template v-slot:prepend>
                              <div class="text-subtitle1 text-bold">ObjKey : </div>
                            </template>
                          </q-input>
                          <q-input class="col-6" input-class="text-subtitle1 text-bold" filled square
                            v-model="addCondition.editor"
                            :rules="[(val) => val.length || alertValidateFail('Value must not be empty')]" dense
                            lazy-rules hide-bottom-space>
                            <template v-slot:prepend>
                              <div class="text-subtitle1 text-bold">Editor : </div>
                            </template>
                          </q-input>
                        </q-form>
                      </q-tab-panel>
                    </q-tab-panels>
                  </q-tab-panel>
                </q-tab-panels>

                <div class="column justify-end items-end">
                  <q-btn type="submit" :form="activeForm" color="primary" icon="fa-regular fa-paper-plane" class="q-ma-sm"
                    title="query" glossy push round />
                </div>
              </div>
            </template>
          </q-splitter>
        </div>
        <div class="col-9 q-pt-md">
          <q-table v-if="tableRows.length" class="fit vsTable" :columns="tableCols" :title="tableTitle"
            :rows="operation === 'Edit' && editMode === 'delete' && deleteMode === 'selection' ? selectedRows : tableRows"
            row-key="recId" selection="multiple" v-model:selected="selectedRows" separator="vertical" virtual-scroll
            :pagination="{ rowsPerPage: 0 }" :rows-per-page-options="[0]" square :virtual-scroll-sticky-size-start="48"
            hide-bottom :filter="tableFilter">
            <template v-slot:top-right>
              <q-input v-model="tableFilter" type="text" class="q-mr-md" dense debounce="500" placeholder="Query...">
                <template v-slot:prepend>
                  <q-icon name="fa-solid fa-magnifying-glass" />
                </template>
              </q-input>
            </template>
            <template v-slot:header-cell-recId>
              <q-th class="text-center">index</q-th>
            </template>
            <template v-slot:body-cell-recId="props">
              <q-td class="text-center" :data-recId="props.value">{{ props.rowIndex + 1 }}</q-td>
            </template>
          </q-table>
          <div v-else class="fit row justify-center items-center">
            <div class="text-h4 text-bold">
              <span class="q-mr-md">Query result</span>
              <q-spinner-dots color="blue" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from 'vue';
import { Dialog } from 'quasar';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAppStatusStore } from 'src/stores/appStatus';
import { usePermissionStore } from 'src/stores/permission';
import { useS3ObjectStore } from 'src/stores/s3Object';
import { useAlertHandlerStore } from 'src/stores/alertHandler';

const appStatus = useAppStatusStore();
const permission = usePermissionStore();
const s3Object = useS3ObjectStore();
const { makeAlert } = useAlertHandlerStore();

const svrUrl = process.env.API_URL;
const queryObjs = ['action', 'createdTimeNum', 'editor', 'objKey'];
const filterObjs = ['action', 'editor', 'objKey'];
const deleteObjs = ['action', 'bucket', 'createdTimeNum', 'editor', 'objKey'];
const actionList = ['create', 'upload', 'modify', 'switch', 'delete', 'restore'];

const operation = ref('Query');
const editMode = ref('delete');
const deleteMode = ref('condition');

const bucketList = computed(() => (
  permission?.userInfo.isAdmin ? ['All'].concat(s3Object.availbleBuckets) : s3Object.availbleBuckets
));

const timePicker = ref(null);
const delTimePicker = ref(null);
const addTimePicker = ref(null);
const curTimeStr = dayjs().format('YYYYMMDD');

const queryCondition = ref({
  bucket: s3Object.curBucket,
  mainObj: 'action',
  objVal: actionList[0],
});
const filters = ref([]);
const deleteCondition = ref({
  obj: 'action',
  objVal: actionList[0],
});
const addCondition = ref({
  bucket: s3Object.curBucket,
  objKey: '',
  action: actionList[0],
  editor: permission?.userInfo?.username || '',
  createdTimeNum: curTimeStr,
});

const activeForm = computed(() => (
  operation.value === 'Query'
    ? 'queryHistoryForm'
    : editMode.value === 'delete'
      ? 'deleteHistoryForm' : 'addHistoryForm'
));

const tableTitle = ref('');
const tableCols = ref([]);
const tableRows = ref([]);
const tableFilter = ref('');
const selectedRows = ref([]);

const displayPickupTime = computed(() => {
  const { objVal } = queryCondition.value;
  return `${objVal.from || objVal} ~ ${objVal.to || objVal}`;
});
const displayDelPickupTime = computed(() => {
  const { objVal } = deleteCondition.value;
  return `${objVal.from || objVal} ~ ${objVal.to || objVal}`;
});

function checkRedundantFilter(val) {
  return val !== queryCondition.value.mainObj
    && filters.value.reduce((result, { mainObj }) => result + (mainObj === val), 0) === 1;
}

function alertValidateFail(errMsg) {
  makeAlert('error', 'QueryConfig', errMsg);
  return '';
}

function resetCondObjVal(mainObj) {
  if (mainObj === 'action') {
    [queryCondition.value.objVal] = actionList;
  } else if (mainObj === 'createdTimeNum') {
    queryCondition.value.objVal = {
      from: curTimeStr,
      to: curTimeStr,
    };
  } else {
    queryCondition.value.objVal = '';
  }
}

function resetFilterObjVal(index) {
  if (filters.value[index].mainObj === 'action') {
    [filters.value[index].objVal] = actionList;
  } else {
    filters.value[index].objVal = '';
  }
}

function resetDeleteObjVal(obj) {
  switch (obj) {
    case 'bucket':
      [deleteCondition.value.objVal] = s3Object.availbleBuckets;
      break;
    case 'action':
      [deleteCondition.value.objVal] = actionList;
      break;
    case 'createdTimeNum':
      deleteCondition.value.objVal = {
        from: curTimeStr,
        to: curTimeStr,
      };
      break;
    default:
      deleteCondition.value.objVal = '';
  }
}

function addFilter() {
  filters.value.push({
    mainObj: 'action',
    objVal: actionList[0],
  });
}

function removeFilter(index) {
  filters.value.splice(index, 1);
}

async function getHistory() {
  const { bucket, mainObj, objVal } = queryCondition.value;
  const reqConfig = {
    obj: mainObj,
    objVal: mainObj === 'createdTimeNum'
      ? objVal.from ? `${objVal.from}~${objVal.to}` : objVal
      : objVal,
    ...(filters.value.length && {
      filters: filters.value.reduce((result, filter) => {
        result[filter.mainObj] = filter.objVal;
        return result;
      }, {}),
    }),
  };

  tableRows.value = (await axios.post(
    `${svrUrl}/s3History${bucket !== 'All' ? `?bucket=${bucket}` : ''}`,
    reqConfig,
    { headers: { Authorization: `Bearer ${permission.token}` } },
  )).data.data;

  tableTitle.value = `Operation history - Queried at ${dayjs().format('HH:mm:ss')} on ${dayjs().format('YYYY/MM/DD')}`;
  tableCols.value = [];
  Object.keys(tableRows.value[0] || {}).forEach((key) => {
    tableCols.value.push({
      name: key,
      label: key === 'recId' ? 'index' : key,
      field: (row) => (key === 'createdAt' ? dayjs(row[key]).format('YYYY/MM/DD HH:mm') : row[key]),
      sortable: key !== 'recId',
    });
  });
}

function deleteHistory() {
  Dialog.create({
    title: '<div class="text-h5 text-red text-bold">⚠ Delete History</div>',
    message: '<div class="text-subtitle1 text-italic ">Are you sure to delete the history?</div>',
    ok: {
      label: 'Delete',
      color: 'red',
      noCaps: true,
      push: true,
    },
    cancel: {
      label: 'Cancel',
      color: 'grey-7',
      noCaps: true,
      push: true,
    },
    html: true,
  })
    .onOk(async () => {
      appStatus.isProcessing = true;
      if (deleteMode.value === 'condition') {
        try {
          const { failure } = (await axios.delete(
            `${svrUrl}/s3History`,
            {
              headers: { Authorization: `Bearer ${permission.token}` },
              data: deleteCondition.value,
            },
          )).data;

          if (failure.length) {
            makeAlert('error', 'deleteHistory', 'Error occur when deleting history');
            failure.forEach((f) => console.log(`[deleteHistory] Error: ${f}`));
          } else makeAlert('info', 'deleteHistory', 'Success to delete history');
        } catch (err) {
          makeAlert('error', 'deleteHistory', 'Fail to delete the history', err);
        }
      } else {
        const results = await Promise.allSettled(selectedRows.value.map((row) => (
          axios.delete(
            `${svrUrl}/s3History`,
            {
              headers: { Authorization: `Bearer ${permission.token}` },
              data: {
                obj: 'recId',
                objVal: row.recId,
              },
            },
          )
        )));
        const fails = [];

        results.forEach((result, index) => {
          if (result.status === 'rejected') fails.push(index);
        });
        if (fails.length) makeAlert('error', 'deleteHistory', `Fail to delete the history: selected at ${fails.join(',')}`);
        else makeAlert('info', 'deleteHistory', 'Success to delete history');
        deleteMode.value = 'condition';
        selectedRows.value = [];
        getHistory().then(() => makeAlert('info', 'deleteHistory', 'Success to refresh query result'));
      }
      appStatus.isProcessing = false;
    });
}

async function addHistory() {
  try {
    await axios.put(
      `${svrUrl}/s3History/${s3Object.curBucket}`,
      addCondition.value,
      { headers: { Authorization: `Bearer ${permission.token}` } },
    );
    makeAlert('info', 'addHistory', 'Success to add history');
  } catch (err) {
    makeAlert('error', 'addHistory', 'Fail to add history', err);
  }
}
</script>

<style>
.adminOperationTabs .q-tab {
  min-height: calc(100% / 2);
}

.userOperationTabs .q-tab {
  min-height: 100%;
}

.q-field--filled.q-field--readonly .q-field__control::before {
  border: none !important;
}

.q-table tbody td {
  font-size: 16px;
}

.vsTable .q-table__top {
  background-color: lightskyblue;
}

.vsTable thead tr th {
  position: sticky;
  z-index: 1;
  font-size: 18px;
  font-weight: bold;
  background-color: lightcyan;
}

.vsTable thead tr:last-child th {
  top: 48px;
}

.vsTable thead tr:first-child th {
  top: 0;
}
</style>
