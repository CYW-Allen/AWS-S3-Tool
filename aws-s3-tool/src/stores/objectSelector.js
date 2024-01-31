import { defineStore } from 'pinia';
import DragSelect from 'dragselect';
import axios from 'axios';
import { useAppStatusStore } from './appStatus';
import { useS3ObjectStore } from './s3Object';
import { useAlertHandlerStore } from './alertHandler';

export const useObjectSelectorStore = defineStore('objectSelector', () => {
  const appStatus = useAppStatusStore();
  const s3Object = useS3ObjectStore();
  const { makeAlert } = useAlertHandlerStore();

  function configDragSelect() {
    if (!appStatus.isMobile) {
      appStatus.dragSelect = new DragSelect({
        selectables: document.getElementsByClassName('fileObj'),
        area: document.getElementById('selectArea'),
        draggability: false,
      });

      appStatus.dragSelect.subscribe('DS:added', (callbackObj) => {
        if (callbackObj.item) {
          const newAddEleId = callbackObj.item.id;
          if (appStatus.selections.includes(newAddEleId)) {
            document.getElementById(newAddEleId).classList.add('selectedObj', 'glossy');
          }
        }
      });

      appStatus.dragSelect.subscribe('DS:select', (callbackObj) => {
        callbackObj.item.classList.add('selectedObj', 'glossy');
      });

      appStatus.dragSelect.subscribe('DS:unselect', (callbackObj) => {
        callbackObj.item.classList.remove('selectedObj', 'glossy');
      });

      appStatus.dragSelect.subscribe('DS:end', (callbackObj) => {
        const { event, items } = callbackObj;
        const [secondLastEle, lastEle] = items.slice(-2) || [];

        if (event && event.shiftKey && secondLastEle && lastEle) {
          const newSelections = [];
          const lastEleIndex = Number(lastEle.dataset.index);
          const secondlastEleIndex = Number(secondLastEle.dataset.index);

          for (
            let i = secondlastEleIndex;
            lastEleIndex > secondlastEleIndex ? i <= lastEleIndex : i >= lastEleIndex;
            i += lastEleIndex > secondlastEleIndex ? 1 : -1
          ) {
            newSelections.push(s3Object.objsInCurDir[i][0]);
          }

          const existedEles = newSelections.reduce((result, id) => {
            const ele = document.getElementById(id);
            if (ele) result.push(ele);
            return result;
          }, []);

          appStatus.dragSelect.setSelection(existedEles, false);
          appStatus.selections = newSelections;
        } else {
          const selectedIds = items.map((item) => item.id);
          const newSelections = event && event.ctrlKey ? selectedIds : selectedIds.slice(-1);

          appStatus.selections.forEach((selected) => {
            if (!newSelections.includes(selected)) {
              document.getElementById(selected)?.classList?.remove('selectedObj', 'glossy');
            }
          });
          appStatus.selections = newSelections;
        }
      });
    }
  }

  function initStatus() {
    appStatus.curSelectUrl = '';
    appStatus.previewImgUrl = '';
    appStatus.previewDocUrl = '';
    appStatus.onlySelectFile = true;
  }

  function handleSelectionsChange() {
    initStatus();
    if (appStatus.selections.length) {
      appStatus.selections.forEach((selected) => {
        appStatus.onlySelectFile &&= s3Object.bucketStructure[s3Object.curDirectory][selected].isFile;
      });

      const lastSelectObj = appStatus.selections.slice(-1)[0];

      if (s3Object.bucketStructure[s3Object.curDirectory][lastSelectObj].isFile && s3Object.curDomain) {
        const fileExt = lastSelectObj.split('.').slice(-1)[0].toLowerCase();
        const encodeUrl = `https://${s3Object.curDomain}${encodeURI(lastSelectObj)}`;

        appStatus.curSelectUrl = `https://${s3Object.curDomain}${lastSelectObj}`;

        switch (fileExt) {
          case 'png':
          case 'jpg':
          case 'jpeg':
          case 'gif':
            appStatus.previewImgUrl = `${encodeUrl}?${Date.now()}`;
            break;
          case 'yaml':
            appStatus.previewDocUrl = `${encodeUrl}?${Date.now()}`;
            axios.get(appStatus.previewDocUrl)
              .then((data) => { appStatus.previewYaml = data; })
              .catch((err) => {
                makeAlert('error', 'handleSelectionsChange', 'Fail to get yaml content', err);
              });
            break;
          default:
            appStatus.previewDocUrl = `${encodeUrl}?${Date.now()}`;
        }
      }
    }
  }

  return {
    configDragSelect,
    handleSelectionsChange,
  };
});
