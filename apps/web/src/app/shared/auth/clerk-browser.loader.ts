export async function loadClerkBrowser() {
  return import('@clerk/clerk-js/no-rhc');
}
