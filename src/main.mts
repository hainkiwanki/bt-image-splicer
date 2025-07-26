import './styles/vuetify.scss';
import '@mdi/font/css/materialdesignicons.css';
import App from './App.vue';
import { createApp } from 'vue';
import { router } from './router/index.mjs';
import { vuetify } from './plugins/vuetify.mjs';

const app = createApp(App);
app.use(router);
app.use(vuetify);
app.mount('#app');
