<template>
  <!-- linked records are chips, like the foreign key arrays of core -->
  <span class="af-many2many-show flex flex-wrap">
    <span
      v-for="value in values"
      :key="value.value"
      class="inline-flex items-center rounded-full m-0.5 h-5 px-2 text-xs font-medium bg-lightButtonGroupActiveBackground text-lightButtonGroupActiveText dark:bg-darkButtonGroupActiveBackground dark:text-darkButtonGroupActiveText"
    >
      <RouterLink
        :to="`/resource/${props.meta.linkedResourceId}/show/${value.value}`"
        class="font-medium whitespace-nowrap hover:underline"
      >
        {{ value.label }}
      </RouterLink>
    </span>
  </span>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { callAdminForthApi } from '@/utils';
import { RouterLink } from 'vue-router';


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
    values.value = resp.data;
  } catch (error) {
    console.error('Error loading foreign options:', error);
  }
});

</script>