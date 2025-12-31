import { AdminForthPlugin, Filters } from "adminforth";
import type { IAdminForth, IHttpServer, AdminForthResourcePages, AdminForthResourceColumn, AdminForthDataTypes, AdminForthResource } from "adminforth";
import type { PluginOptions } from './types.js';

export default class ManyToManyPlugin extends AdminForthPlugin {
  options: PluginOptions;
  private junctionResource: AdminForthResource | null = null;
  private linkedColumnNameInJunctionResource: string | null = null;
  private resourceColumnNameInJunctionResource: string | null = null;

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
        this.junctionResource = resource;
        break;
      }
    }
    if (!this.junctionResource) {
      throw new Error(`Junction resource not found for many-to-many relation between ${resourceConfig.resourceId} and ${this.options.linkedResourceId}`);
    }
    this.linkedColumnNameInJunctionResource = this.junctionResource.columns.find(c => c.foreignResource?.resourceId === this.options.linkedResourceId)?.name || null;
    this.resourceColumnNameInJunctionResource = this.junctionResource.columns.find(c => c.foreignResource?.resourceId === resourceConfig.resourceId)?.name || null;

    if (!this.linkedColumnNameInJunctionResource || !this.resourceColumnNameInJunctionResource) {
      throw new Error(`Junction resource is missing foreign key columns for relation ${resourceConfig.resourceId} <-> ${this.options.linkedResourceId}`);
    }

    const pluginFrontendOptions = {
      pluginInstanceId: this.pluginInstanceId,
      resourceId: resourceConfig.resourceId,
      linkedResourceId: this.options.linkedResourceId,
      junctionResourceId: this.junctionResource ? this.junctionResource.resourceId : null,
      linkedColumnName: this.linkedColumnNameInJunctionResource,
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
        show: {
          file: this.componentPath('ManyToManyShow.vue'),
          meta: pluginFrontendOptions,
        },
      },
      showIn: {
        create: true,
        edit: true,
        list: false,
        show: true,
        filter: false,
      },
      required: {
        create: false,
        edit: false
      },
      label: this.options.labelForColumn || this.options.linkedResourceId,
      showIf: this.options.showIf || null,
    };
    resourceConfig.columns.push(virtualColumn);

    // ** HOOKS FOR CREATE **//

    resourceConfig.hooks.create.afterSave.push(async ({ recordId, recordWithVirtualColumns, adminUser }) => {
      if ( recordWithVirtualColumns[`many2many_${this.pluginInstanceId}`] ) {
        for(const linkedId of recordWithVirtualColumns[`many2many_${this.pluginInstanceId}`]) {
          await this.adminforth.createResourceRecord({
            resource: this.junctionResource,
            record: {
              [this.resourceColumnNameInJunctionResource]: recordId,
              [this.linkedColumnNameInJunctionResource]: linkedId,
            },
            adminUser
          });
        }
      }
      return { ok: true };
    });

    // ** HOOKS FOR EDIT **//

    resourceConfig.hooks.edit.beforeSave.push(async ({recordId, updates, adminUser }: { recordId: any, updates: any, adminUser: any }) => {
      if ( updates[`many2many_${this.pluginInstanceId}`] ) {
        const existingJunctionRecords = await this.adminforth.resource(this.junctionResource.resourceId).list([Filters.EQ(this.resourceColumnNameInJunctionResource, recordId)]);
        const updatedLinkedIds = updates[`many2many_${this.pluginInstanceId}`];
        for(const jr of existingJunctionRecords) {
          const linkedId = jr[this.linkedColumnNameInJunctionResource];
          if ( !updatedLinkedIds.includes(linkedId) ) {
            await this.adminforth.deleteResourceRecord({
              resource: this.junctionResource,
              recordId: jr[this.junctionResource.columns.find(c => c.primaryKey).name],
              record: jr,
              adminUser
            });
          }
        }
        for(const linkedId of updatedLinkedIds) {
          const alreadyExists = existingJunctionRecords.find(jr => jr[this.linkedColumnNameInJunctionResource] === linkedId);
          if ( !alreadyExists ) {
            await this.adminforth.createResourceRecord({
              resource: this.junctionResource,
              record: {
                [this.resourceColumnNameInJunctionResource]: recordId,
                [this.linkedColumnNameInJunctionResource]: linkedId,
              },
              adminUser
            });
          }
        }
      }
      return { ok: true };
    });

    // ** HOOKS FOR DELETE **//
    if (!this.options.dontDeleteJunctionRecords) {
      resourceConfig.hooks.delete.beforeSave.push(async ({ recordId, record, adminUser }: { recordId: any, record: any, adminUser: any }) => {
        if (recordId === undefined || recordId === null || recordId === '') {
          return { ok: true };
        }
        const existingJunctionRecords = await this.adminforth.resource(this.junctionResource.resourceId).list([Filters.EQ(this.resourceColumnNameInJunctionResource, recordId)]);
        for(const jr of existingJunctionRecords) {
          await this.adminforth.deleteResourceRecord({
            resource: this.junctionResource,
            recordId: jr[this.junctionResource.columns.find(c => c.primaryKey).name],
            record: jr,
            adminUser
          });
        }
        return { ok: true };
      });
      const linkedResource = this.adminforth.config.resources.find(r => r.resourceId === this.options.linkedResourceId);
      if (!linkedResource) {
        throw new Error(`Linked resource not found: ${this.options.linkedResourceId}`);
      }
      linkedResource.hooks.delete.beforeSave.push(async ({ recordId, record, adminUser }: { recordId: any, record: any, adminUser: any }) => {
        if (recordId === undefined || recordId === null || recordId === '') {
          return { ok: true };
        }
        const existingJunctionRecords = await this.adminforth.resource(this.junctionResource.resourceId).list([Filters.EQ(this.linkedColumnNameInJunctionResource, recordId)]);
        for(const jr of existingJunctionRecords) {
          await this.adminforth.deleteResourceRecord({
            resource: this.junctionResource,
            recordId: jr[this.junctionResource.columns.find(c => c.primaryKey).name],
            record: jr,
            adminUser
          });
        }
        return { ok: true };
      });
    }
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
        const { recordId, returnLabels } = body;
        if (recordId === undefined || recordId === null || recordId === '') {
          return { ok: true, data: [] };
        }
        const junctionRecords = await this.adminforth.resource(this.junctionResource.resourceId).list([Filters.EQ(this.resourceColumnNameInJunctionResource, recordId)]);
        const dataToReturn = [];
        const linkedResourceConfig = this.adminforth.config.resources.find(r => r.resourceId === this.options.linkedResourceId);
        if (!linkedResourceConfig) {
          throw new Error(`Linked resource not found: ${this.options.linkedResourceId}`);
        }
        const linkedPkColumn = linkedResourceConfig.columns.find(c => c.primaryKey);
        if (!linkedPkColumn) {
          throw new Error(`Linked resource ${this.options.linkedResourceId} has no primary key`);
        }
        const linkedOperationalResource = this.adminforth.resource(this.options.linkedResourceId);
        for(const jr of junctionRecords) {
          const linkedId = jr[this.linkedColumnNameInJunctionResource];
          if (!returnLabels) {
            dataToReturn.push(linkedId);
          } else {
            const linkedRecord = await linkedOperationalResource.get([Filters.EQ(linkedPkColumn.name, linkedId)]);
            dataToReturn.push(
              (linkedOperationalResource as any).resourceConfig.recordLabel ? {
                label: (linkedOperationalResource as any).resourceConfig.recordLabel(linkedRecord),
                value: linkedRecord[linkedPkColumn.name]
              } : {
                label: linkedRecord[linkedPkColumn.name],
                value: linkedRecord[linkedPkColumn.name]
              }
            );
          }
        }
        return { ok: true, data: dataToReturn };
      }
    });
  }

}