import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Home from '@/views/Home.vue';

const routes: RouteRecordRaw[] = [{ path: '/', name: 'Home', component: Home }];

export const router = createRouter({
    history: createWebHistory(),
    routes,
});
