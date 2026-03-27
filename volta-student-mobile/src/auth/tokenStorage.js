import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'volta.api.bearer_token';

export async function getApiToken() {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function setApiToken(token) {
  if (token) {
    await AsyncStorage.setItem(KEY, token);
  } else {
    await AsyncStorage.removeItem(KEY);
  }
}

export async function clearApiToken() {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
