import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { useAlertHandlerStore } from './alertHandler';

export const usePermissionStore = defineStore('permission', () => {
  const { makeAlert } = useAlertHandlerStore();

  const svrUrl = process.env.API_URL;
  const token = ref(window.localStorage.getItem('token'));
  const userInfo = computed(() => {
    try {
      return jwtDecode(token.value);
    } catch {
      return null;
    }
  });

  async function getPermission(type, username, password) {
    try {
      token.value = (await axios.post(
        `${svrUrl}/users/${type}`,
        { username, password },
      )).data.token;
      window.localStorage.setItem('token', token.value);
      makeAlert('info', 'getPermission', 'Success to get permission');
    } catch (err) {
      makeAlert('error', 'getPermission', err?.response?.data || 'Fail to get permission', err);
    }
  }

  function logout() {
    window.localStorage.removeItem('token');
    window.location.reload();
  }

  async function editPermissionScopeByAdmin(action, user, bucket) {
    try {
      const { message } = (await axios.patch(
        `${svrUrl}/users/${user}/scope?action=${action}&bucket=${bucket}`,
        null,
        {
          headers: {
            Authorization: `Bearer ${token.value}`,
            'Content-Type': 'application/json',
          },
        },
      )).data;

      makeAlert('info', 'editPermissionScope', message);
    } catch (err) {
      makeAlert('error', 'editPermissionScope', err?.response?.data || 'Fail to edit permission', err);
    }
  }

  async function removePermissionByAdmin(user) {
    try {
      const { message } = (await axios.delete(
        `${svrUrl}/users/${user}`,
        { headers: { Authorization: `Bearer ${token.value}` } },
      )).data;

      makeAlert('info', 'removePermission', message);
    } catch (err) {
      makeAlert('error', 'removePermission', err?.response?.data || `Fail to remove ${user}'s permission`, err);
    }
  }

  return {
    token,
    userInfo,
    getPermission,
    logout,
    editPermissionScopeByAdmin,
    removePermissionByAdmin,
  };
});
