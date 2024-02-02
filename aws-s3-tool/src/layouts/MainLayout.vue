<template>
  <auth-handler v-if="!permission.token" />
  <q-layout v-else view="hHh LpR fFf">
    <q-header elevated class="bg-blue-2">
      <q-bar class="glossy q-py-lg">
        <q-icon class="q-mr-md" size="sm" name="fa-solid fa-database" />
        <q-select class="titleField q-mr-md" borderless dropdown-icon="fa-solid fa-caret-down"
          v-model="s3Object.curBucket" :options="s3Object.availbleBuckets"
          :hide-dropdown-icon="s3Object.availbleBuckets.length < 2" />
        <q-space />
        <q-icon name="fa-solid fa-user" size="sm" />
        <div class="titleField q-mr-lg">{{ permission.userInfo.username }}</div>
        <q-icon v-if="permission.userInfo.isAdmin" class="cursor-pointer q-mr-lg" name="fa-solid fa-users-gear" size="sm"
          title="user permission" @click="appStatus.showPermissionHandler = true" />
        <q-icon class="cursor-pointer q-mr-lg" name="fa-regular fa-rectangle-list" size="sm" title="object history"
          @click="appStatus.showBucketHistory = true" />
        <q-icon class="cursor-pointer" size="sm" name="fa-solid fa-right-from-bracket" title="logout"
          @click="permission.logout" />
      </q-bar>
      <directory-block />
    </q-header>

    <q-page-container>
      <q-page :style-fn="tweakPageH" class="bg-light-blue-1" style="overflow: hidden">
        <bucket-structure />
        <operation-tools />
      </q-page>
    </q-page-container>

    <q-footer elevated class="bg-blue-2">
      <latest-selected-info v-if="s3Object.curCDNId" />
    </q-footer>
  </q-layout>

  <permission-handler />
  <bucket-history />
  <object-uploader v-if="permission.token" />
  <q-inner-loading :showing="appStatus.isProcessing">
    <div class="text-blue-8 text-h4 q-mb-md">
      <span class="q-mr-sm">Request processing...</span>
      <q-spinner-ios color="primary" />
    </div>
  </q-inner-loading>
</template>

<script setup>
import { useAppStatusStore } from 'src/stores/appStatus';
import { usePermissionStore } from 'src/stores/permission';
import { useS3ObjectStore } from 'src/stores/s3Object';

import AuthHandler from 'src/components/AuthHandler.vue';
import PermissionHandler from 'src/components/admin/PermissionHandler.vue';
import BucketHistory from 'src/components/admin/BucketHistory.vue';
import BucketStructure from 'src/components/BucketStructure.vue';
import DirectoryBlock from 'src/components/DirectoryBlock.vue';
import LatestSelectedInfo from 'src/components/LatestSelectedInfo.vue';
import ObjectUploader from 'src/components/ObjectUploader.vue';
import OperationTools from 'src/components/OperationTools.vue';

const appStatus = useAppStatusStore();
const permission = usePermissionStore();
const s3Object = useS3ObjectStore();

const tweakPageH = (offset) => ({ height: offset ? `calc(100vh - ${offset}px)` : '100vh' });

</script>

<style>
.titleField {
  font-size: 24px !important;
}

.titleField .q-field__native,
.titleField .q-field__marginal {
  color: white;
}
</style>
