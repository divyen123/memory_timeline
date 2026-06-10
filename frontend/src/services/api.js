import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL;
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/,"");
export const getImageUrl = (image) => (
  image?.startsWith("http") ? image : `${API_ORIGIN}/uploads/${image}`
);

const API = axios.create({
baseURL:API_BASE_URL
});

/* ADD TOKEN */

API.interceptors.request.use((req)=>{

const token = localStorage.getItem("token");

if(token){
req.headers.Authorization = `Bearer ${token}`;
}

return req;

});

API.interceptors.response.use(
  (res)=>res,
  (error)=>{
    if(error.response?.status === 401){
      localStorage.removeItem("token");
      window.location.href = "/";
    }

    return Promise.reject(error);
  }
);

/* ADD MEMORY */
export const addMemory = (data)=>API.post("/memories",data);

/* DELETE MEMORY */
export const deleteMemory = (id)=>API.delete(`/memories/${id}`);
export const getTrashMemories = ()=>API.get("/memories/trash");
export const restoreMemory = (id)=>API.patch(`/memories/${id}/restore`);
export const restoreMemories = (ids)=>API.post("/memories/trash/restore", {ids});
export const permanentlyDeleteMemory = (id)=>API.delete(`/memories/${id}/permanent`);
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
export const getPublicShare = (token)=>API.get(`/public/share/${token}`);

/* AUTH */
export const loginUser = (data)=>API.post("/login",data);
export const registerUser = (data)=>API.post("/register",data);
export const completeOnboarding = ()=>API.patch("/onboarding/complete");
export const requestResetCode = (data)=>API.post("/request-reset-code",data);
export const resetPassword = (data)=>API.post("/reset-password",data);
export const getProfile = ()=>API.get("/profile");
export const updateProfile = (data)=>API.put("/profile",data);
export const updatePassword = (data)=>API.put("/profile/password",data);
export const getAppearanceSettings = (profile)=>API.get(`/profile/settings/${profile}`);
export const updateAppearanceSettings = (profile,settings)=>API.put(`/profile/settings/${profile}`, {settings});

export default API;
