<template>
  <Select
    class="w-full"
    :options="selectOptions"
    v-model="selected"
    multiple
  ></Select>
</template>


<script lang="ts" setup>
import { Select, Button } from '@/afcl'
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

onMounted(async() => {
  loadForeignOptions();
  console.log('Props record in ManyToManyInput:', props);
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
});

async function loadForeignOptions(){
  try {
    const resp = await callAdminForthApi({
      method: 'POST',
      path: `/get_resource_foreign_data`,
      body: {
        resourceId: props.meta.junctionResourceId,
        column: props.meta.linkedColumnName,
        limit: 100,
        offset: 0,
        search: '',
      },
    });
    selectOptions.value = resp.items
  } catch (error) {
    console.error('Error loading foreign options:', error);
  }
}


watch(() => selected.value, (value) => {
  emit('update:value', value);
});

</script>