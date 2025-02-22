
export const ELEVEN_LABS_API_KEY = import.meta.env.VITE_ELEVEN_LABS_API_KEY || '';

if (!ELEVEN_LABS_API_KEY) {
  console.error('Missing ELEVEN_LABS_API_KEY environment variable');
}
