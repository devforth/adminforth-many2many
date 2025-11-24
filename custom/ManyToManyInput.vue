<template>
  <Select
    class="w-full"
    :options="selectOptions"
    v-model="selected"
    multiple
    @search="loadForeignOptions"
    @scroll-near-end="scrollNearEnd"
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
const currentSearch = ref('')
const lastSearch = ref('')
const loadOffset = ref(0);
const wasLimitReached = ref(false);

onMounted(async() => {
  if ( !props.record || Object.keys(props.record).length === 0 ) {
    loadForeignOptions();
  } else {
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
  }
});

async function loadForeignOptions(search = '', offset = 0) {
  lastSearch.value = currentSearch.value;
  currentSearch.value = search;
  try {
    const resp = await callAdminForthApi({
      method: 'POST',
      path: `/get_resource_foreign_data`,
      body: {
        resourceId: props.meta.junctionResourceId,
        column: props.meta.linkedColumnName,
        limit: 100,
        offset: offset,
        search: search,
      },
    });
    
    wasLimitReached.value = resp.items.length < 100;
    const removeValues = pickedValues.value.map(i => i.value);
    const result = resp.items.filter(item => !removeValues.includes(item.value));
    selectOptions.value = selectOptions.value.filter(item => !removeValues.includes(item.value));
    const removeValues2 = selectOptions.value.map(i => i.value);
    const finalResult = result.filter(item => !removeValues2.includes(item.value));

    selectOptions.value = [...pickedValues.value, ...selectOptions.value, ...finalResult];
  } catch (error) {
    console.error('Error loading foreign options:', error);
  }
}

function scrollNearEnd() {
  console.log('scrollNearEnd');
  if ( lastSearch.value !== currentSearch.value ) {
    loadOffset.value = 0;
  } else {
    loadOffset.value += 100;
  }
  if ( wasLimitReached.value ) return;
  loadForeignOptions(currentSearch.value, loadOffset.value);
}

watch(() => selected.value, (value) => {
  pickedValues.value.push(selectOptions.value.find(i => i.value === value[value.length -1]));
  emit('update:value', value);
});

</script>