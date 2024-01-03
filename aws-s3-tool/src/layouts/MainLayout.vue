<template>
  <q-layout view="hHh LpR fFf">
    <q-header elevated class="bg-blue-2">
      <q-bar class="glossy q-py-md">
        <q-icon class="q-mr-md" name="fa-solid fa-database" />
      </q-bar>
    </q-header>

    <q-page-container>
      <q-page :style-fn="tweakPageH" class="bg-light-blue-1" style="overflow: hidden">

      </q-page>
    </q-page-container>

    <q-footer elevated class="bg-blue-2">

    </q-footer>
  </q-layout>
</template>

<script setup>

const tweakPageH = (offset) => ({ height: offset ? `calc(100vh - ${offset}px)` : '100vh' });

</script>
