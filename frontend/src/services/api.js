import axios from "axios";
import { clearAuthenticatedUser, setAuthenticatedUser } from "../auth";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/,"");
const isInlineOrLocalPreviewImage = (image = "") => {
  const imageUrl = String(image || "");

  return (
    imageUrl.startsWith("blob:") ||
    imageUrl.startsWith("data:")
  );
};

const getMemoryImageList = (memory, kind = "images") => {
  if(kind === "thumbnails"){
    return memory?.thumbnails || [];
  }

  return memory?.images?.length ? memory.images : (memory?.image ? [memory.image] : []);
};

export const getImageUrl = (image) => (
  isInlineOrLocalPreviewImage(image || "") ? image : ""
);

export const getMemoryImageUrl = (memory, kind = "images", index = 0) => {
  const images = getMemoryImageList(memory, kind);
  const image = images[index];

  if(!image){
    return "";
  }

  if(isInlineOrLocalPreviewImage(image)){
    return image;
  }

  return `${API_BASE_URL}/memories/${memory._id}/images/${kind}/${index}/view`;
};

export const getPublicMemoryImageUrl = (token, memory, index = 0) => {
  const images = getMemoryImageList(memory, "images");
  const image = images[index];

  if(!image){
    return "";
  }

  if(isInlineOrLocalPreviewImage(image)){
    return image;
  }

  return `${API_BASE_URL}/public/share/${token}/images/${memory._id}/${index}/view`;
};

export const requiresAuthenticatedImageFetch = (url = "") => {
  const imageUrl = String(url || "");

  return imageUrl.startsWith(API_BASE_URL) && imageUrl.includes("/memories/") && imageUrl.includes("/view");
};

const API = axios.create({
baseURL:API_BASE_URL,
withCredentials:true
});

API.interceptors.response.use(
  (res)=>res,
  async(error)=>{
    const originalRequest = error.config || {};
    const url = String(originalRequest.url || "");
    const isAuthEndpoint = ["/login", "/register", "/request-reset-code", "/reset-password", "/auth/refresh"].some((path)=>url.includes(path));

    if(error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint){
      originalRequest._retry = true;

      try{
        const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {withCredentials:true});
        setAuthenticatedUser(refreshResponse.data.userId);
        return API(originalRequest);
      }catch{
        clearAuthenticatedUser();
        window.location.href = "/";
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

/* ADD MEMORY */
export const addMemory = (data)=>API.post("/memories",data);

/* DELETE MEMORY */
export const deleteMemory = (id)=>API.delete(`/memories/${id}`);
export const clearAllMemories = ()=>API.delete("/memories");
export const getTrashMemories = ()=>API.get("/memories/trash");
export const getHiddenMemories = ()=>API.get("/memories/hidden");
export const restoreMemory = (id)=>API.patch(`/memories/${id}/restore`);
export const restoreMemories = (ids)=>API.post("/memories/trash/restore", {ids});
export const permanentlyDeleteMemory = (id)=>API.delete(`/memories/${id}/permanent`);
export const hideMemory = (id)=>API.patch(`/memories/${id}/hide`);
export const unhideMemory = (id)=>API.patch(`/memories/${id}/unhide`);
export const permanentlyDeleteHiddenMemory = (id)=>API.delete(`/memories/${id}/hidden-permanent`);
export const permanentlyDeleteMemories = (ids)=>API.post("/memories/trash/permanent-delete", {ids});
export const emptyTrash = ()=>API.delete("/memories/trash/empty");

/* UPDATE MEMORY */
export const updateMemory = (id,data)=>API.put(`/memories/${id}`,data);

/* GET MEMORIES */
export const getMemories = (params)=>API.get("/memories",{params});
export const getMemory = (id)=>API.get(`/memories/${id}`);
export const downloadMemoryImage = (id,index)=>API.get(`/memories/${id}/images/${index}/download`, {
  responseType:"blob"
});
export const toggleFavorite = (id)=>API.patch(`/memories/${id}/favorite`);
export const createMemoryShare = (id)=>API.post(`/memories/${id}/share`);
export const createCategoryShare = (data)=>API.post("/share/category",data);
export const revokeMemoryShare = (id)=>API.delete(`/memories/${id}/share`);
export const revokeCategoryShare = (data)=>API.delete("/share/category", {data});
export const getPublicShare = (token)=>API.get(`/public/share/${token}`);

/* AUTH */
export const loginUser = (data)=>API.post("/login",data);
export const registerUser = (data)=>API.post("/register",data);
export const getSession = ()=>API.get("/auth/session");
export const refreshSession = (config = {})=>API.post("/auth/refresh", {}, config);
export const logoutUser = ()=>API.post("/logout");
export const logoutAllSessions = ()=>API.post("/logout-all");
export const completeOnboarding = ()=>API.patch("/onboarding/complete");
export const requestResetCode = (data)=>API.post("/request-reset-code",data);
export const resetPassword = (data)=>API.post("/reset-password",data);
export const getProfile = ()=>API.get("/profile");
export const updateProfile = (data)=>API.put("/profile",data);
export const deleteAccount = ()=>API.delete("/profile");
export const updatePassword = (data)=>API.put("/profile/password",data);
export const getAppearanceSettings = (profile)=>API.get(`/profile/settings/${profile}`);
export const updateAppearanceSettings = (profile,settings)=>API.put(`/profile/settings/${profile}`, {settings});

export default API;
