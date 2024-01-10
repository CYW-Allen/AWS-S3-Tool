import { defineStore } from 'pinia';
import dayjs from 'dayjs';
import { Notify } from 'quasar';

export const useAlertHandlerStore = defineStore('alertHandler', () => {
  function makeAlert(type, caller, message, err) {
    if (type === 'info') {
      Notify.create({
        type: 'positive',
        icon: 'fa-regular fa-circle-check',
        message,
      });
    } else {
      const occurTime = dayjs().format('YYYY/MM/DD HH:mm:ss');

      Notify.create(message);
      console.log(`${occurTime} [${caller}] Error: ${err || message}`);
    }
  }

  return {
    makeAlert,
  };
});
