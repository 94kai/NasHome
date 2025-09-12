import { createApp } from 'vue';
import App from './components/App.vue';
import router from './js/router';
import './css/style.css';

const app = createApp(App);

app.use(router);

app.mount('#app');
