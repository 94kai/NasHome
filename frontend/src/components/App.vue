<template>
  <!-- Render the layout with a sidebar if the route is NOT 'Login' -->
  <div v-if="$route.name !== 'Login'" id="app-container">
    <div class="mobile-top-bar">
      <button @click="toggleMobileMenu" class="hamburger-btn">☰</button>
    </div>
    <div class="sidebar" :class="{ 'is-open': isMobileMenuOpen }">
      <h2>导航</h2>
      <ul class="main-nav">
        <li v-for="item in navItems" :key="item.name" @click="navigateTo(item.path)" :class="{ active: $route.path === item.path }">
          {{ item.name }}
        </li>
      </ul>
    </div>
    <div class="overlay" v-if="isMobileMenuOpen" @click="closeMobileMenu"></div>
    <div class="content">
      <router-view></router-view>
    </div>
  </div>
  <!-- Otherwise, just render the component for the 'Login' route -->
  <router-view v-else></router-view>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      isMobileMenuOpen: false,
      navItems: [
        { name: '链接', path: '/links' },
        { name: '工具 1', path: '/tool1' },
        { name: '工具 2', path: '/tool2' },
        { name: '工具 3', path: '/tool3' },
      ]
    };
  },
  methods: {
    navigateTo(path) {
      if (this.$route.path !== path) {
        this.$router.push(path);
      }
      this.closeMobileMenu();
    },
    toggleMobileMenu() {
      this.isMobileMenuOpen = !this.isMobileMenuOpen;
    },
    closeMobileMenu() {
      this.isMobileMenuOpen = false;
    }
  }
};
</script>

<style>
.main-nav li.active {
    background-color: #007bff;
    color: white;
}
</style>
