/**
 * Paste your Firebase project's web config here (Firebase console → Project settings → Your apps → Web app).
 * `databaseURL` is required: create a Realtime Database first so the console includes it.
 */
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

export function isConfigured(): boolean {
  return (
    !firebaseConfig.apiKey.startsWith('YOUR_') &&
    !firebaseConfig.databaseURL.includes('YOUR_')
  );
}
