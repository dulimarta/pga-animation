<template>
  Input Control 
  <v-text-field type="number" v-model="driveWheelSpeed"/>
</template>
<script setup lang="ts">
import { usePGAStore } from '~/store/pga-store';
import {storeToRefs} from "pinia"
const store = usePGAStore()
const {driveWheelSpeed} = storeToRefs(store)
</script>