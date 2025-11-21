<template>
 <template v-for="value in values" :key="value.value">
    <Link :to="`/resource/${props.meta.linkedResourceId}/show/${value.value}`" class="badge bg-primary me-1">{{ value.label }}</Link>
 </template>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { callAdminForthApi } from '@/utils';
import { Link } from '@/afcl'


const props = defineProps<{
  column: any,
  record: any,
  meta: any,
  resource: any
}>();

const emit = defineEmits([
  'update:value',
]);

const values = ref([]);

onMounted(async() => {
  if ( !props.record || Object.keys(props.record).length === 0 ) return;
  try {
    const resp = await callAdminForthApi({
      method: 'POST',
      path: `/plugin/${props.meta.pluginInstanceId}/get-junctionResource-records`,
      body: {
        recordId: props.record[props.meta.resourcePrimaryKeyColumnName],
        returnLabels: true,
      },
    });
    console.log('SHOW resp', resp);
    values.value = resp.data;
  } catch (error) {
    console.error('Error loading foreign options:', error);
  }
});

</script>