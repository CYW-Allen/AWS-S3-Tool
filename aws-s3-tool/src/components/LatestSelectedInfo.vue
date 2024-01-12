<template>
  <div class="fit row no-wrap q-pa-sm">
    <q-field outlined class="col q-mr-sm">
      <template v-slot:before>
        <div class="text-bold">Current selection</div>
      </template>
      <template v-slot:control>
        <div class="text-h6" id="curSelectUrl">{{ appStatus.curSelectUrl }}</div>
      </template>
    </q-field>
    <q-btn-group glossy push>
      <q-btn icon="fa-solid fa-copy" color="blue-9" :disable="!appStatus.curSelectUrl" title="copy to clipboard"
        @click="copy2Clipboard(appStatus.curSelectUrl)" />
      <q-btn icon="fa-solid fa-eye" color="green-9" :disable="!appStatus.curSelectUrl" title="View object in new tab"
        @click="viewSelectedInNewTab" />
    </q-btn-group>
  </div>
</template>

<script setup>
import { useAppStatusStore } from 'src/stores/appStatus';
import { useAlertHandlerStore } from 'src/stores/alertHandler';

const appStatus = useAppStatusStore();
const { makeAlert } = useAlertHandlerStore();

async function copy2Clipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
    else {
      const textSelector = window.getSelection();
      const selectRange = document.createRange();

      selectRange.selectNodeContents(document.getElementById('curSelectUrl'));
      textSelector.removeAllRanges();
      textSelector.addRange(selectRange);
      document.execCommand('copy');
    }
    makeAlert('info', 'copy2Clipboard', 'The url has already been copied to clipboard');
  } catch (err) {
    makeAlert('error', 'copy2Clipboard', 'Fail to copy to clipboard', err);
  }
}

function viewSelectedInNewTab() {
  window.open(appStatus.curSelectUrl, '_blank').focus();
}

</script>

<style scoped></style>
