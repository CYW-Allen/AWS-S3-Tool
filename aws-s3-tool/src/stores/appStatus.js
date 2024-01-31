import { defineStore } from 'pinia';
import { Platform } from 'quasar';
import { ref } from 'vue';

export const useAppStatusStore = defineStore('appStatus', () => (
  {
    reserveWords: process.env.RESERVE_WORDS.split(','),
    isMobile: Platform.is.mobile,

    showPermissionHandler: ref(false),

    dragSelect: ref(null),
    selections: ref([]),
    onlySelectFile: ref(false),
    objDisplayArea: ref(null),

    curSelectUrl: ref(''),
    previewImgUrl: ref(''),
    previewDocUrl: ref(''),
    previewYaml: ref(''),

    renameObjId: ref(''),
    preName: ref(''),
    tempName: ref(''),
    refreshList: ref([]),
    restoreList: ref([]),

    isProcessing: ref(false),
    latestProcessingNum: ref(0),
    uploadStatus: ref({}),
    uploadFails: ref([]),

    onModifying: ref(false),
    onCreatingFolder: ref(false),
    cutStorage: ref([]),

    preStep: ref([]),
    nextStep: ref([]),

    isOperObj: ref(false),

    operHist: ref([]),

    curObjVerList: ref([]),
    newObjVerIndex: ref(null),

    queryTarget: ref(null),
  }
));
