<template>
  <q-layout view="hHh lpR fFf">
    <q-header class="premium-header">
      <q-toolbar>
        <q-toolbar-title class="premium-title">
          PRIMEFORM
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
// Premium minimal layout - no drawer, no menu, just focus
</script>

<style scoped>
.premium-header {
  background: #000000;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.premium-title {
  text-align: center;
  font-family: 'Montserrat', sans-serif;
  font-weight: 900;
  font-style: italic;
  color: #D4AF37;
  letter-spacing: 3px;
  font-size: 1.5rem;
}
</style>
