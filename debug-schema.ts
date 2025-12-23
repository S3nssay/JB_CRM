
import { tenants } from "./shared/schema";
console.log("Tenants Schema Keys:", Object.keys(tenants));
// If it's a pgTable, checking columns:
// @ts-ignore
console.log("Tenants columns:", Object.keys(tenants).filter(k => typeof tenants[k] === 'object' && tenants[k]?.name));
const columns = {};
for (const key in tenants) {
    // @ts-ignore
    if (tenants[key]?.config?.name) {
        // @ts-ignore
        columns[key] = tenants[key].config.name;
    }
}
console.log("Columns:", columns);
