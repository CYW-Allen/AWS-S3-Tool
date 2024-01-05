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

  async function editPermission(user, scope, isAdmin) {
    try {
      const { message } = (await axios.patch(
        `${svrUrl}/users/${user}/permission`,
        { scope, isAdmin },
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

  async function removePermission(user) {
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

  async function listUsers() {
    try {
      return (await axios.get(
        `${svrUrl}/users`,
        { headers: { Authorization: `Bearer ${token.value}` } },
      )).data.data
        .filter((user) => user.username !== userInfo.value.username)
        .reduce((result, user) => {
          result[user.username] = user;
          return result;
        }, {});
      // .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      makeAlert('error', 'listUsers', 'Fail to get all users', err);
      return [];
    }
  }

  async function listAllBuckets() {
    try {
      return Object.keys((await axios.get(
        `${svrUrl}/s3Buckets/infos`,
        { headers: { Authorization: `Bearer ${token.value}` } },
      )).data.data);
    } catch (err) {
      makeAlert('error', 'listAllBuckets', 'Fail to get all buckets', err);
      return [];
    }
  }

  return {
    token,
    userInfo,
    getPermission,
    logout,
    editPermission,
    removePermission,
    listUsers,
    listAllBuckets,
  };
});
