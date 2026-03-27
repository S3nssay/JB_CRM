
import { users } from "./shared/schema";
console.log("Users Keys:", Object.keys(users));
// @ts-ignore
if (users.username) console.log("Has username column");
// @ts-ignore
if (users.role) console.log("Has role column");
