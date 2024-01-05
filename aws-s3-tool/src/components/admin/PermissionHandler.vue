<template>
  <q-dialog v-model="appStatus.showPermissionHandler" persistent maximized>
    <div class="fit column bg-white">
      <q-bar class="glossy">
        <div class="text-bold">User Infos</div>
        <q-space />
        <q-btn dense flat icon="fa-solid fa-xmark" v-close-popup>
          <q-tooltip class="bg-white text-primary">Close</q-tooltip>
        </q-btn>
      </q-bar>

      <div class="col q-pa-md bg-light-blue-1">
        <q-table class="fit" card-container-class="full-height" card-container-style="overflow-y: auto;" title="Users"
          title-class="text-h5 text-bold" :rows="userList" row-key="username" :rows-per-page-options="[0]"
          :pagination="{ rowsPerPage: 0 }" hide-bottom :filter="filter" grid hide-header @click="processConfig">
          <template v-slot:top-right>
            <q-input borderless dense debounce="300" v-model="filter" placeholder="Search">
              <template v-slot:append>
                <q-icon name="fa-solid fa-magnifying-glass" />
              </template>
            </q-input>
          </template>

          <template v-slot:item="props">
            <div class="q-pa-xs col-xs-12 col-sm-6 col-md-4 col-lg-3 grid-style-transition">
              <q-card>
                <q-card-section>
                  <div class="row justify-between items-center">
                    <div class="text-h6 text-bold row items-center">
                      <q-icon :name="props.row.isAdmin ? 'fa-solid fa-user-gear' : 'fa-solid fa-user'" class="q-mr-sm"
                        :color="props.row.isAdmin ? 'indigo-6' : 'black'" />
                      <span :class="props.row.isAdmin ? 'text-indigo-6' : 'text-black'">{{ props.row.username }}</span>
                    </div>
                    <div class="text-right">
                      <q-icon name="fa-solid fa-file-arrow-up" size="sm" color="primary"
                        class="q-mr-lg cursor-pointer funcBtn" title="update config" data-func="update"
                        :data-user="props.row.username" />
                      <q-icon name="fa-solid fa-arrow-rotate-left" color="green" size="sm" class="cursor-pointer funcBtn"
                        title="reset config" data-func="reset" :data-user="props.row.username" />
                    </div>
                  </div>
                </q-card-section>
                <q-separator />
                <q-list>
                  <q-item v-for="col in props.cols.filter(col => col.name !== 'username')" :key="col.name">
                    <q-item-section>
                      <div class="text-bold infoProp">{{ col.name }}</div>
                    </q-item-section>
                    <q-item-section>
                      <q-select v-if="col.name === 'bucketScope'" filled
                        :label="props.row.isAdmin ? 'Full access' : 'Accessible buckets'"
                        v-model="users[props.row.username].bucketScope" :options="buckets" multiple hide-selected
                        :disable="props.row.isAdmin">
                        <template v-slot:option="{ itemProps, opt, selected, toggleOption }">
                          <q-item v-bind="itemProps">
                            <q-item-section>
                              <q-item-label>{{ opt }}</q-item-label>
                            </q-item-section>
                            <q-item-section side>
                              <q-toggle :model-value="selected" @update:model-value="toggleOption(opt)" />
                            </q-item-section>
                          </q-item>
                        </template>
                      </q-select>
                      <q-toggle v-else-if="col.name === 'isAdmin'" v-model="users[props.row.username].isAdmin"
                        color="primary" :label="props.row.isAdmin ? 'Administrator' : 'Normal user'" />
                      <q-item-label v-else>{{ col.value }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-card>
            </div>
          </template>

        </q-table>
      </div>
    </div>
  </q-dialog>
</template>

<script setup>
import { useAppStatusStore } from 'src/stores/appStatus';
import { usePermissionStore } from 'src/stores/permission';
import { useAlertHandlerStore } from 'src/stores/alertHandler';
import { computed, ref, watch } from 'vue';

const appStatus = useAppStatusStore();
const { listUsers, listAllBuckets, editPermission } = usePermissionStore();
const { makeAlert } = useAlertHandlerStore();

const originUsers = ref({});
const users = ref({});
const userList = computed(() => (
  Object.values(users.value)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
));
const filter = ref('');

const buckets = ref([]);

function initUsersInfos(data) {
  Object.keys(data).forEach((user) => {
    originUsers.value[user] = { ...data[user] };
    users.value[user] = { ...data[user] };
  });
}

function processConfig(event) {
  if (event.target.matches('.funcBtn')) {
    const { func, user } = event.target.dataset;

    if (func === 'update') {
      const { username, bucketScope, isAdmin } = users.value[user];

      editPermission(username, isAdmin ? [] : bucketScope, isAdmin)
        .then(async () => {
          initUsersInfos(await listUsers());
          makeAlert('info', 'processConfig', 'Success to refresh user list');
        });
    } else {
      users.value[user].bucketScope = originUsers.value[user].bucketScope.slice();
      users.value[user].isAdmin = originUsers.value[user].isAdmin;
    }
  }
}

watch(() => appStatus.showPermissionHandler, async (v) => {
  if (v) {
    listUsers()
      .then((val) => { initUsersInfos(val); });

    listAllBuckets()
      .then((val) => { buckets.value = val; });
  }
});

</script>

<style>
.infoProp::first-letter {
  text-transform: capitalize;
}
</style>
