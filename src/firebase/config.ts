/**
 * Paste your Firebase project's web config here (Firebase console → Project settings → Your apps → Web app).
 * `databaseURL` is required: create a Realtime Database first so the console includes it.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyCZ79LGZWXJP8g6xUIpUkvBDwUNiVOYlbM',
  authDomain: 'coup-6b538.firebaseapp.com',
  databaseURL:
    'https://coup-6b538-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'coup-6b538',
  storageBucket: 'coup-6b538.firebasestorage.app',
  messagingSenderId: '811587359425',
  appId: '1:811587359425:web:f2c8f7e77f866e5823fa40',
};

export function isConfigured(): boolean {
  return (
    !firebaseConfig.apiKey.startsWith('YOUR_') &&
    !firebaseConfig.databaseURL.includes('YOUR_')
  );
}
