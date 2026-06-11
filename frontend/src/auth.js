export const AUTH_UPDATED_EVENT = "memory-app-auth-updated";
const AUTH_USER_KEY = "memory-app-user-id";

export const getAuthenticatedUserId = () => localStorage.getItem(AUTH_USER_KEY) || "";

export const setAuthenticatedUser = (userId) => {
  if(userId){
    localStorage.setItem(AUTH_USER_KEY, userId);
  }
  window.dispatchEvent(new CustomEvent(AUTH_UPDATED_EVENT, {detail:{userId:userId || ""}}));
};

export const clearAuthenticatedUser = () => {
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem("token");
  window.dispatchEvent(new CustomEvent(AUTH_UPDATED_EVENT, {detail:{userId:""}}));
};
