export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { FactoryDispatcher } = await import("@/src/server/services/factory-dispatcher");
  const dispatcher = new FactoryDispatcher();
  dispatcher.start();
}
