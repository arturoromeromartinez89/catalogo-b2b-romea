const target = process.argv[2] || "staging";
const environment = process.env.VITE_DEPLOY_ENV || "";
const url = process.env.VITE_SUPABASE_URL || "";
const productionRef = "pyignizeoevafifzfnik";

if (!url) throw new Error("VITE_SUPABASE_URL is missing.");
if (target === "staging" && (environment !== "staging" || url.includes(productionRef))) {
  throw new Error("Staging is not isolated from production.");
}
if (target === "production" && (environment !== "production" || !url.includes(productionRef))) {
  throw new Error("Production is not connected to the approved production project.");
}

console.log(`PASS: ${target} environment is connected to its expected Supabase project.`);
