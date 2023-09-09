<template>
  <v-btn>Hans Here</v-btn>
  <v-icon>mdi-wifi-alert</v-icon>
  
  <!--div>
    <NuxtWelcome />
  </!--div-->
</template>
<script lang="ts" setup>
import Algebra from 'ts-geometric-algebra';

const Complex = Algebra(0, 1)
const a = new Complex([3, 2])
const b = new Complex([-3,5])
console.log("Is this a complex number", a, b)
console.log("I'm here")
</script>
<style lang="scss">
@use "./settings"
</style>
