import { AdminForthPlugin, Filters } from "adminforth";
import type { IAdminForth, IHttpServer, AdminForthResourcePages, AdminForthResourceColumn, AdminForthDataTypes, AdminForthResource } from "adminforth";
import type { PluginOptions } from './types.js';

let junctionResource = null;
let linkedColumnNameInJunctionResource = null;
let resourceColumnNameInJunctionResource = null;
export default class  extends AdminForthPlugin {
  options: PluginOptions;

  constructor(options: PluginOptions) {
    super(options, import.meta.url);
    this.options = options;
  }

  async modifyResourceConfig(adminforth: IAdminForth, resourceConfig: AdminForthResource) {
    super.modifyResourceConfig(adminforth, resourceConfig);

    for(const resource of this.adminforth.config.resources) {
      let wasLinkedResourceFound = false;
      let wasCurrentResourceFound = false;
      for(const column of resource.columns) {
        if ( column.foreignResource?.resourceId === this.options.linkedResourceId ) {
          wasLinkedResourceFound = true;
        } else if ( column.foreignResource?.resourceId === resourceConfig.resourceId ) {
          wasCurrentResourceFound = true;
        } 
      }
      if ( wasLinkedResourceFound && wasCurrentResourceFound ) {
        junctionResource = resource;
        break;
      }
    }
    if (!junctionResource) {
      throw new Error(`Junction resource not found for many-to-many relation between ${resourceConfig.resourceId} and ${this.options.linkedResourceId}`);
    }

    linkedColumnNameInJunctionResource = junctionResource.columns.find(c => c.foreignResource?.resourceId === this.options.linkedResourceId)?.name;
    resourceColumnNameInJunctionResource = junctionResource.columns.find(c => c.foreignResource?.resourceId === resourceConfig.resourceId)?.name;

    const pluginFrontendOptions = {
      pluginInstanceId: this.pluginInstanceId,
      resourceId: resourceConfig.resourceId,
      linkedResourceId: this.options.linkedResourceId,
      junctionResourceId: junctionResource ? junctionResource.resourceId : null,
      linkedColumnName: linkedColumnNameInJunctionResource,
      resourcePrimaryKeyColumnName: resourceConfig.columns.find(c => c.primaryKey)?.name,
    }

    const virtualColumn: AdminForthResourceColumn = {
      virtual: true,
      name: `many2many_${this.pluginInstanceId}`,
      components: {
        edit: {
          file: this.componentPath('ManyToManyInput.vue'),
          meta: pluginFrontendOptions,
        },
        create: {
          file: this.componentPath('ManyToManyInput.vue'),
          meta: pluginFrontendOptions,
        },
      },
      showIn: {
        create: true,
        edit: true,
        list: false,
        show: false,
        filter: false,
      },
      required: {
        create: false,
        edit: false
      },
      label: this.options.linkedResourceId
    };
    resourceConfig.columns.push(virtualColumn);

    // ** HOOKS FOR CREATE **//

    resourceConfig.hooks.create.afterSave.push(async ({ recordId, recordWithVirtualColumns }: { recordId: any, recordWithVirtualColumns: any }) => {
      if ( recordWithVirtualColumns[`many2many_${this.pluginInstanceId}`] ) {
        for(const linkedId of recordWithVirtualColumns[`many2many_${this.pluginInstanceId}`]) {
          await this.adminforth.resource(junctionResource.resourceId).create({
            [resourceColumnNameInJunctionResource]: recordId,
            [linkedColumnNameInJunctionResource]: linkedId,
          });
        }
      }
      return { ok: true };
    });

    // ** HOOKS FOR EDIT **//

    resourceConfig.hooks.edit.beforeSave.push(async ({recordId, updates }: { recordId: any, updates: any }) => {
      if ( updates[`many2many_${this.pluginInstanceId}`] ) {
        for(const linkedId of updates[`many2many_${this.pluginInstanceId}`]) {
          //console.log(`Would create junction record for ${recordId} <-> ${linkedId}`);

        }
      }
      return { ok: true };
    });

    // ** HOOKS FOR DELETE **//

    resourceConfig.hooks.delete.beforeSave.push(async ({ recordId, record }: { recordId: any, record: any }) => {
      //console.log('DELETE HOOK many2many BEFORE SAVE', recordId, record);
      if ( record[`many2many_${this.pluginInstanceId}`] ) {
        for(const linkedId of record[`many2many_${this.pluginInstanceId}`]) {
          //console.log(`Would delete junction record for ${recordId} <-> ${linkedId}`);

        }
      }
      return { ok: true };
    });
  }
  
  validateConfigAfterDiscover(adminforth: IAdminForth, resourceConfig: AdminForthResource) {
    // optional method where you can safely check field types after database discovery was performed
  }

  instanceUniqueRepresentation(pluginOptions: any) : string {
    // optional method to return unique string representation of plugin instance. 
    // Needed if plugin can have multiple instances on one resource 
    return `many2many-${this.resourceConfig.resourceId}-${this.options.linkedResourceId}`;
  }

  setupEndpoints(server: IHttpServer) {
    server.endpoint({
      method: 'POST',
      path: `/plugin/${this.pluginInstanceId}/get-junctionResource-records`,
      handler: async ({ body }) => {
        const { recordId } = body;
        const junctionRecords = await this.adminforth.resource(junctionResource.resourceId).list([Filters.EQ(resourceColumnNameInJunctionResource, recordId)]);
        let dataToReturn = [];
        const junctionResourcePkColumn = junctionResource.columns.find(c => c.primaryKey);
        for(const jr of junctionRecords) {
          const record = await this.adminforth.resource(this.options.linkedResourceId).get([Filters.EQ(junctionResourcePkColumn.name, jr[linkedColumnNameInJunctionResource])]);
          dataToReturn.push(record[junctionResourcePkColumn.name],
          );
        }
        return { ok: true, data: dataToReturn };
      }
    });
  }

}