let accessToken = localStorage.getItem('accessToken') || null;

export const tokenStore = {
  get: () => accessToken,
  set: (t) => {
    accessToken = t || null;
    if (t) localStorage.setItem('accessToken', t);
    else localStorage.removeItem('accessToken');
  }
};
