export const getChatWsUrl = (): string => {
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (envUrl) {
    return envUrl.endsWith('/ws/chat') ? envUrl : `${envUrl.replace(/\/$/, '')}/ws/chat`;
  }

  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiUrl && apiUrl.startsWith('http')) {
    const base = apiUrl.replace(/\/api\/?$/, '');
    return base.replace(/^http/, 'ws') + '/ws/chat';
  }

  return '';
};
