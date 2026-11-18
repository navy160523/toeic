import { createApp } from 'vue';
import { createVuetify } from 'vuetify';
import { VAlert, VApp, VBtn, VCard, VChip, VDialog, VMain, VProgressLinear, VSnackbar, VTextarea, VTextField } from 'vuetify/components';
import 'vuetify/styles';
import './style.css';
import App from './App.vue';

const vuetify = createVuetify({
  components: { VAlert, VApp, VBtn, VCard, VChip, VDialog, VMain, VProgressLinear, VSnackbar, VTextarea, VTextField },
  theme: { themes: { light: { colors: { primary: '#194eaf', background: '#f5f7fb', surface: '#ffffff' } } } },
  defaults: { VBtn: { rounded: 'lg', elevation: 0 }, VCard: { rounded: 'xl', elevation: 0 }, VTextField: { variant: 'outlined', density: 'comfortable' } },
});
createApp(App).use(vuetify).mount('#app');
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('PWA cache registration failed', error));
}
