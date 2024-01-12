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

      appStatus.dragSelect.subscribe('DS:end', (selectObj) => {
        if (appStatus.multiChoose && selectObj.items.length > 1) {
          const [secondLastEle, lastEle] = selectObj.items.slice(-2);
          const lastEleIndex = Number(lastEle.getAttribute('indexnum'));
          const secondlastEleIndex = Number(secondLastEle.getAttribute('indexnum'));
          const newSelection = [];

          appStatus.dragSelect.clearSelection(false);
          for (
            let i = secondlastEleIndex;
            lastEleIndex > secondlastEleIndex ? i <= lastEleIndex : i >= lastEleIndex;
            i += lastEleIndex > secondlastEleIndex ? 1 : -1
          ) {
            const objEle = document.getElementById(s3Object.objsInCurDir[i][0]);

            appStatus.dragSelect.addSelection(objEle);
            newSelection.push(objEle);
          }
          appStatus.selections = newSelection;
        } else {
          appStatus.selections = selectObj.items;
        }
      });
    }
  }

  function initStatus() {
    const preSelection = Array.from(document.getElementsByClassName('selectedObj'));

    preSelection.forEach((selected) => { selected.classList.remove('selectedObj', 'glossy'); });
    appStatus.curSelectUrl = '';
    appStatus.previewImgUrl = '';
    appStatus.previewDocUrl = '';
    appStatus.onlySelectFile = true;
  }

  function handleSelectionsChange() {
    initStatus();
    if (appStatus.selections.length) {
      appStatus.selections.forEach((selected) => {
        selected.classList.add('selectedObj', 'glossy');
        appStatus.onlySelectFile &&= selected.classList.contains('isFile');
      });

      const lastSelectObj = appStatus.selections.slice(-1)[0];

      if (lastSelectObj.classList.contains('isFile') && s3Object.curDomain) {
        const fileExt = lastSelectObj.id.split('.').slice(-1)[0].toLowerCase();
        const encodeUrl = `https://${s3Object.curDomain}${encodeURI(lastSelectObj.id)}`;

        appStatus.curSelectUrl = `https://${s3Object.curDomain}${lastSelectObj.id}`;

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
