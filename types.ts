import { Predicate } from "adminforth"
export interface PluginOptions {
  linkedResourceId: string
  dontDeleteJunctionRecords?: boolean 
  labelForColumn?: string
  showIf?: Predicate
}
