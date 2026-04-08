import { Predicate } from "adminforth"
import  {type PluginsCommonOptions } from "adminforth";

export interface PluginOptions extends PluginsCommonOptions {
  linkedResourceId: string
  dontDeleteJunctionRecords?: boolean 
  labelForColumn?: string
  showIf?: Predicate
}
