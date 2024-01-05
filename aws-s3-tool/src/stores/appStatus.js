import { defineStore } from 'pinia';
import { Platform } from 'quasar';
import { ref } from 'vue';

export const useAppStatusStore = defineStore('appStatus', () => (
  {
    reserveWords: process.env.RESERVE_WORDS.split(','),
    isMobile: Platform.is.mobile,

    showPermissionHandler: ref(false),

    contentScrollArea: ref(null),

    dragSelect: ref(null),
    selections: ref([]),
    onlySelectFile: ref(false),
    multiChoose: ref(false),
    curSelectUrl: ref(''),
    previewImgUrl: ref(''),
    previewDocUrl: ref(''),
    previewYaml: ref(''),

    cutStorage: ref([]),
    renameObjId: ref(''),
    preName: ref(''),
    tempName: ref(''),
    reqList: ref(null),
    refreshList: ref([]),

    isProcessing: ref(false),
    isUploading: ref(false),
    uploadLimit: 50,
    onModifying: ref(false),
    onCreatingFolder: ref(false),
    onCutting: ref(false),

    preStep: ref([]),
    nextStep: ref([]),

    isOperObj: ref(false),

    queryString: ref(''),
    queryResult: ref([]),

    operHist: ref([]),

    curObjVerList: ref([]),
    newObjVerIndex: ref(null),
  }
));
