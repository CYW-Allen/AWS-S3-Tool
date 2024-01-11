<template>
  <div class="window-width window-height row justify-center items-center bg-grey-3">
    <q-card style="width: 30%">
      <q-tabs v-model="curAuthMode" class="text-grey bg-light-blue-1" active-class="text-white bg-blue-6"
        indicator-color="indigo-10" align="justify">
        <q-tab content-class="costomTab" v-for="(mode, i) in authMode" :key="`tab-${i}`" :name="mode" :label="mode" />
      </q-tabs>
      <q-tab-panels v-model="curAuthMode" animated>
        <q-tab-panel v-for="(mode, i) in authMode" :key="`tab-panel-${i}`" :name="mode">
          <q-input class="authInput q-mt-lg" input-class="text-h6 text-black q-mx-sm" square bg-color="blue-2"
            v-model="inputField[mode].username" dense autofocus hint="* alphanumeric characters (length: 1 ~ 10)"
            :rules="nameValidations" bottom-slots tabindex="1">
            <template v-slot:before>
              <div class="q-ml-sm row justify-center items-center text-h6 text-blue-9 text-bold">
                <div>Username</div>
              </div>
            </template>
          </q-input>
          <q-input class="authInput q-mt-lg" input-class="text-h6 text-black q-mx-sm" square bg-color="blue-2"
            v-model="inputField[mode].password" :type="showPassword ? 'text' : 'password'" dense tabindex="2"
            hint="* alphanumeric characters (length: 5 ~ 10)" :rules="pwdValidations" bottom-slots>
            <template v-slot:before>
              <div class="q-ml-sm row justify-center items-center text-h6 text-blue-9 text-bold">
                <div>Password</div>
              </div>
            </template>
            <template v-slot:append>
              <q-icon :name="`fa-solid ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`" class="cursor-pointer q-ml-sm"
                color="grey-6" @click="showPassword = !showPassword" />
            </template>
          </q-input>
          <div class="full-width text-right q-mt-lg">
            <q-btn glossy color="blue-8" title="get permission" icon="fa-solid fa-arrow-right-to-bracket"
              :disable="!(validName && validPwd)" @click="sendRequest(mode)" />
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAppStatusStore } from 'src/stores/appStatus';
import { usePermissionStore } from 'src/stores/permission';

const appStatus = useAppStatusStore();
const permission = usePermissionStore();

const authMode = ['signin', 'signup'];
const curAuthMode = ref('signin');
const inputField = ref({
  signin: {
    username: '',
    password: '',
  },
  signup: {
    username: '',
    password: '',
  },
});
const validName = ref(false);
const validPwd = ref(false);
const showPassword = ref(false);

const nameValidations = [
  (val) => {
    validName.value = /^[a-zA-Z0-9]{1,10}$/.test(val);
    return validName.value || '⚠ Only accept alphanumeric characters (length: 1 ~ 10)';
  },
];
const pwdValidations = [
  (val) => {
    validPwd.value = /^[a-zA-Z0-9]{5,10}$/.test(val);
    return validPwd.value || '⚠ Only accept alphanumeric characters (length: 5 ~ 10)';
  },
];

async function sendRequest(mode) {
  appStatus.isProcessing = true;
  await permission.getPermission(mode, inputField.value[mode].username, inputField.value[mode].password);
  appStatus.isProcessing = false;
}

</script>

<style>
.costomTab .q-tab__label {
  font-size: 20px;
  font-weight: 600;
}

.q-field--dense .q-field__append {
  padding-right: 6px;
}

.authInput .q-field__before {
  background-color: lightskyblue;
}

.authInput .q-field__bottom {
  font-size: 14px;
  color: indigo;
}

.authInput.q-field--error .q-field__bottom {
  font-size: 14px;
  font-style: italic;
  color: red;
}
</style>
