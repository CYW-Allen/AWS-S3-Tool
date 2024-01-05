<template>
  <auth-handler v-if="!permission.token" />
  <q-layout v-else view="hHh LpR fFf">
    <q-header elevated class="bg-blue-2">
      <q-bar class="glossy q-py-lg">
        <q-icon class="q-mr-md" size="sm" name="fa-solid fa-database" />
        <q-select class="titleField q-mr-md" borderless dropdown-icon="fa-solid fa-caret-down" v-model="curBucket"
          :options="permission.userInfo.bucketScope" :hide-dropdown-icon="permission.userInfo.bucketScope.length < 2" />
        <q-space />
        <q-icon name="fa-solid fa-user" size="sm" />
        <div class="titleField q-mr-lg">{{ permission.userInfo.username }}</div>
        <q-icon v-if="permission.userInfo.isAdmin" class="cursor-pointer q-mr-lg" name="fa-solid fa-users-gear" size="sm"
          title="user permission" @click="appStatus.showPermissionHandler = true" />
        <q-icon class="cursor-pointer q-mr-lg" name="fa-regular fa-rectangle-list" size="sm" title="object history" />
        <q-icon class="cursor-pointer" size="sm" name="fa-solid fa-right-from-bracket" title="logout"
          @click="permission.logout" />
      </q-bar>
    </q-header>

    <q-page-container>
      <q-page :style-fn="tweakPageH" class="bg-light-blue-1" style="overflow: hidden">

      </q-page>
    </q-page-container>

    <q-footer elevated class="bg-blue-2">

    </q-footer>
  </q-layout>

  <permission-handler />
  <q-inner-loading :showing="appStatus.isProcessing">
    <div class="text-blue-8 text-h4 q-mb-md">
      <span class="q-mr-sm">Request processing...</span>
      <q-spinner-ios color="primary" />
    </div>
  </q-inner-loading>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useAppStatusStore } from 'src/stores/appStatus';
import { usePermissionStore } from 'src/stores/permission';

import AuthHandler from 'src/components/AuthHandler.vue';
import PermissionHandler from 'src/components/admin/PermissionHandler.vue';

const appStatus = useAppStatusStore();
const permission = usePermissionStore();
const curBucket = ref(permission?.userInfo?.bucketScope[0] || '');

const tweakPageH = (offset) => ({ height: offset ? `calc(100vh - ${offset}px)` : '100vh' });

watch(() => permission.token, () => {
  [curBucket.value] = permission.userInfo.bucketScope;
});
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
