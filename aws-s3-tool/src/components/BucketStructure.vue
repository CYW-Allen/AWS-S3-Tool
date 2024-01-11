<template>
  <div class="fit row non-selectable" id="/">
    <div class="col full-height column no-wrap">
      <div id="titleField">
        <div :style="`width:${colNameWidth}`" id="colName">
          <span class="cursor-pointer q-pl-sm q-mr-xs" @click.stop="sortObjByCol('name')">Name</span>
          <q-icon v-if="sortByCol.name !== null" :name="`fa-solid fa-angle-${sortByCol.name ? 'up' : 'down'}`"
            color="black" />
        </div>
        <div :style="`width:${colDateWidth}`" id="colDate">
          <span class="cursor-pointer q-pl-sm q-mr-xs" @click.stop="sortObjByCol('date')">Date</span>
          <q-icon v-if="sortByCol.date !== null" :name="`fa-solid fa-angle-${sortByCol.date ? 'up' : 'down'}`"
            color="black" />
        </div>
        <div :style="`width:${colSizeWidth}`" id="colSize">
          <span class="cursor-pointer q-pl-sm q-mr-xs" @click.stop="sortObjByCol('size')">Size</span>
          <q-icon v-if="sortByCol.size !== null" :name="`fa-solid fa-angle-${sortByCol.size ? 'up' : 'down'}`"
            color="black" />
        </div>
      </div>

      <div class="col">
        <q-virtual-scroll ref="scrollArea" class="fit" :items="s3Object.objsInCurDir.slice()" v-slot="{ item, index }">
          <div :key="`${index}-${item[0]}`" :indexnum="index" :id="item[0]"
            :class="`row fileObj q-pl-sm ${item[1].isFile ? 'isFile' : 'isDir'}`"
            @dblclick="browseFolder($event, item[1].isFile)">
            <q-input v-if="appStatus.renameObjId === item[0]" v-model="appStatus.tempName" type="text" label="Label"
              style="width: 50%;" outlined dense bg-color="white" />
            <div v-if="appStatus.renameObjId !== item[0]" class="ellipsis" :style="`width:${colNameWidth}`">
              <q-icon v-if="!item[1].isFile" name="fa-solid fa-folder" class="q-mr-sm" color="orange-7" />
              <span>{{ item[1].name }}</span>
            </div>
            <div v-if="appStatus.renameObjId !== item[0]" class="ellipsis" :style="`width:${colDateWidth}`">
              {{ item[1].lastModified || '' }}
            </div>
            <div v-if="appStatus.renameObjId !== item[0]" class="ellipsis" :style="`width:${colSizeWidth}`">
              {{ item[1].sizeStr || '' }}
            </div>
          </div>
        </q-virtual-scroll>
      </div>
    </div>
    <q-separator vertical />
    <div class="col full-height row justify-center items-center">
      <div v-if="!appStatus.selections.length" class="fit text-h5 row justify-center items-center">
        Preview area
      </div>
      <img v-if="appStatus.previewImgUrl" :src="appStatus.previewImgUrl" class="previewImg" />
      <object v-if="appStatus.previewDocUrl && appStatus.selections[0].id.slice(-5) !== '.yaml'"
        :data="appStatus.previewDocUrl" :width="previewWidth" :height="previewHeight"></object>
      <pre v-if="appStatus.previewDocUrl && appStatus.selections[0].id.slice(-5) === '.yaml'" class="previewYaml"></pre>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useAppStatusStore } from 'src/stores/appStatus';
import { useS3ObjectStore } from 'src/stores/s3Object';

const appStatus = useAppStatusStore();
const s3Object = useS3ObjectStore();

const colNameWidth = ref('65%');
const colDateWidth = ref('25%');
const colSizeWidth = ref('10%');
const COLNAME_MIN_WIDTH = 30.0;
const COLDATE_MIN_WIDTH = 25.0;
const COLSIZE_MIN_WIDTH = 10.0;
let colBarIsDrag = false;

const sortByCol = ref({
  name: null,
  date: null,
  size: null,
});

const scrollArea = ref(null);

const previewWidth = ref(0);
const previewHeight = ref(0);

function resizeCol() {
  const dragBarWidth = 3;
  const titleField = document.getElementById('titleField');
  const colName = document.getElementById('colName');
  const colDate = document.getElementById('colDate');
  const colSize = document.getElementById('colSize');

  let dateBarPosition = 0;
  let sizeBarPosition = 0;
  let curDragField = null;

  function resizeColWidth(e) {
    if (colBarIsDrag) {
      const titleFieldWidth = parseInt(window.getComputedStyle(titleField, null).width, 10);
      const dragDistance = curDragField === 'date'
        ? ((dateBarPosition - e.x) / titleFieldWidth) * 100
        : ((sizeBarPosition - e.x) / titleFieldWidth) * 100;

      if (curDragField === 'date') {
        const colNameNewWidth = (parseFloat(colName.style.width) - dragDistance).toFixed(3);
        const colDateNewWidth = (parseFloat(colDate.style.width) + dragDistance).toFixed(3);

        if (colNameNewWidth > COLNAME_MIN_WIDTH && colDateNewWidth > COLDATE_MIN_WIDTH) {
          colNameWidth.value = `${colNameNewWidth}%`;
          colDateWidth.value = `${colDateNewWidth}%`;
        }
        dateBarPosition = e.x;
      } else {
        const colDateNewWidth = (parseFloat(colDate.style.width) - dragDistance).toFixed(3);
        const colSizeNewWidth = (parseFloat(colSize.style.width) + dragDistance).toFixed(3);

        if (colDateNewWidth > COLDATE_MIN_WIDTH && colSizeNewWidth > COLSIZE_MIN_WIDTH) {
          colDateWidth.value = `${colDateNewWidth}%`;
          colSizeWidth.value = `${colSizeNewWidth}%`;
        }
        sizeBarPosition = e.x;
      }
    }
  }

  colDate.onmousedown = (e) => {
    if (e.offsetX <= dragBarWidth) {
      console.log('datebar dragging');
      curDragField = 'date';
      dateBarPosition = e.x;
      colBarIsDrag = true;
    }
  };
  colSize.onmousedown = (e) => {
    if (e.offsetX <= dragBarWidth) {
      curDragField = 'size';
      sizeBarPosition = e.x;
      colBarIsDrag = true;
    }
  };
  document.onmousemove = resizeColWidth;
  document.onmouseup = () => { colBarIsDrag = false; };
}

function sortObjByCol(targetCol) {
  const previousSortType = sortByCol.value[targetCol];
  const curDirObjs = s3Object.objsInCurDir.slice();
  const cols = ['name', 'date', 'size'];

  cols.forEach((col) => { sortByCol.value[col] = null; });
  if (previousSortType === null) {
    const folders = [];
    const files = [];
    const result = [];

    switch (targetCol) {
      case 'name':
        curDirObjs.sort((a, b) => a[1].name.localeCompare(b[1].name));
        break;
      case 'date':
        curDirObjs.sort((a, b) => a[1].lastTime - b[1].lastTime);
        break;
      case 'size':
        curDirObjs.sort((a, b) => a[1].size - b[1].size);
        break;
      default:
    }
    curDirObjs.forEach((obj) => {
      if (obj[1].isFile) files.push(obj);
      else folders.push(obj);
    });
    folders.forEach((folder) => result.push(folder));
    files.forEach((file) => result.push(file));
    s3Object.objsInCurDir = result;
    sortByCol.value[targetCol] = true;
  } else {
    console.log('reverse');
    s3Object.objsInCurDir.reverse();
    sortByCol.value[targetCol] = !previousSortType;
  }
}

function browseFolder(event, isFile) {
  if (!isFile) {
    appStatus.preStep.push(s3Object.curDirectory);
    s3Object.curDirectory = event.target.id;
    appStatus.nextStep = [];
  }
}

onMounted(() => {
  resizeCol();

  const structureEle = document.getElementById('/');

  previewWidth.value = window.innerWidth > 1000
    ? structureEle.offsetWidth * 0.3 - 10
    : structureEle.offsetWidth - 10;
  previewHeight.value = window.innerWidth > 1000
    ? structureEle.offsetHeight - 10
    : structureEle.offsetHeight * 0.3 - 10;
});

</script>

<style scoped>
#titleField {
  width: 100%;
  font-size: max(12px, 1.2vw);
  font-weight: bold;
  background-color: transparent;
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  border-bottom: 1px solid lightgray;
}

#colDate,
#colSize {
  position: relative;
}

#colDate::after,
#colSize::after {
  content: "";
  background-color: rgb(122, 235, 235);
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: -10px;
  width: 3px;
  height: 100%;
  cursor: col-resize;
}

.fileObj {
  font-size: max(12px, 1vw);
}

.fileObj * {
  pointer-events: none;
}

.selectedObj {
  border: 1px solid rgb(54, 174, 248);
  background-color: rgb(143, 208, 248);
}

.previewImg {
  max-width: 90%;
  max-height: 90%;
}

.previewYaml {
  width: 90%;
  max-height: 80%;
  padding: 10px;
  border: 5px dashed lightslategray;
  overflow: auto;
}
</style>
