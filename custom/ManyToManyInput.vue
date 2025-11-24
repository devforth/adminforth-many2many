<template>
  <Select
    class="w-full"
    :options="selectOptions"
    v-model="selected"
    multiple
    @search="loadForeignOptions"
  ></Select>
</template>


<script lang="ts" setup>
import { Select } from '@/afcl'
import { ref, onMounted, watch } from 'vue';
import { callAdminForthApi } from '@/utils';

const props = defineProps<{
  column: any,
  record: any,
  meta: any,
  resource: any
}>();

const emit = defineEmits([
  'update:value',
]);

const selected = ref([])
const selectOptions = ref([])
const pickedValues = ref([])

onMounted(async() => {
  if ( !props.record || Object.keys(props.record).length === 0 ) return;
  try {
    const resp = await callAdminForthApi({
      method: 'POST',
      path: `/plugin/${props.meta.pluginInstanceId}/get-junctionResource-records`,
      body: {
        recordId: props.record[props.meta.resourcePrimaryKeyColumnName]
      },
    });
    selected.value = resp.data
  } catch (error) {
    console.error('Error loading foreign options:', error);
  }
  try {
    const resp = await callAdminForthApi({
      method: 'POST',
      path: `/plugin/${props.meta.pluginInstanceId}/get-junctionResource-records`,
      body: {
        recordId: props.record[props.meta.resourcePrimaryKeyColumnName],
        returnLabels: true,
      },
    });
   pickedValues.value = resp.data
  } catch (error) {
    console.error('Error loading foreign options:', error);
  }
  loadForeignOptions();
});

async function loadForeignOptions(search = '') {
  try {
    const resp = await callAdminForthApi({
      method: 'POST',
      path: `/get_resource_foreign_data`,
      body: {
        resourceId: props.meta.junctionResourceId,
        column: props.meta.linkedColumnName,
        limit: 100,
        offset: 0,
        search: search,
      },
    });
    
    const removeValues = pickedValues.value.map(i => i.value);

    const result = resp.items.filter(item => !removeValues.includes(item.value));
    
    selectOptions.value = [...result, ...pickedValues.value];
  } catch (error) {
    console.error('Error loading foreign options:', error);
  }
}


watch(() => selected.value, (value) => {
  emit('update:value', value);
});

</script>