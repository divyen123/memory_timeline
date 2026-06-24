import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import JSZip from "jszip";
import MemoryCard from "../components/MemoryCard";
import { useLocation, useNavigate } from "react-router-dom";
import { createCategoryShare, createMemoryShare, downloadMemoryImage, getImageUrl, getMemories, getMemoryImageUrl, deleteMemory, hideMemory, toggleFavorite } from "../services/api";
import PageTransition from "../components/PageTransition";
import SmartImage from "../components/SmartImage";
import useAutoDismissMessage from "../components/useAutoDismissMessage";
import { loadSettings, SETTINGS_PREVIEW_EVENT, SETTINGS_UPDATED_EVENT } from "../settings";
import { playAppSound } from "../sound";
import { shareUrl } from "../share";
import {
  memorySharedLayoutTransition,
  previewContentChildVariants,
  previewDialogVariants,
  previewOverlayVariants
} from "../components/memoryTransition/transitions";

const VIEW_MODES = ["timeline", "calendar", "compact"];
const VIEW_MODE_LABELS = {
  timeline:"Timeline View",
  calendar:"Calendar View",
  compact:"Small Container Cards"
};
const VIEW_MODE_ICONS = {
  timeline:"\u23f0",
  calendar:"\ud83d\udcc5",
  compact:"\u25a6"
};
const SETTINGS_TIP_PENDING_KEY = "memory-settings-tip-pending";
const SETTINGS_TIP_DISMISSED_KEY = "memory-settings-tip-dismissed";

const getMemoryImageList = (memory) => (
  memory?.images?.length ? memory.images : (memory?.image ? [memory.image] : [])
);

const mergeMemoryWithExistingMedia = (memory, existingMemory) => {
  const returnedImages = getMemoryImageList(memory);
  const existingImages = getMemoryImageList(existingMemory);
  const images = returnedImages.length ? returnedImages : existingImages;
  const thumbnails = memory?.thumbnails?.length
    ? memory.thumbnails
    : (existingMemory?.thumbnails || []);

  return {
    ...existingMemory,
    ...memory,
    image:memory?.image || images[0] || existingMemory?.image || "",
    images,
    thumbnails
  };
};

const formatImageBytes = (bytes) => {
  if(!Number.isFinite(bytes) || bytes <= 0){
    return "Unknown";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / (1024 ** index);

  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
};

const getImageTypeLabel = (type, imagePath = "") => {
  const normalizedType = String(type || "").toLowerCase();

  if(normalizedType.includes("webp")){
    return "WebP";
  }

  if(normalizedType.includes("png")){
    return "PNG";
  }

  if(normalizedType.includes("jpeg") || normalizedType.includes("jpg")){
    return "JPEG";
  }

  const extension = String(imagePath).split("?")[0].split(".").pop()?.toLowerCase();

  if(extension === "webp"){
    return "WebP";
  }

  if(extension === "png"){
    return "PNG";
  }

  if(extension === "jpg" || extension === "jpeg"){
    return "JPEG";
  }

  return "Unknown";
};

const formatImageAddedDate = (value) => {
  const date = value ? new Date(value) : null;

  if(!date || Number.isNaN(date.getTime())){
    return "Unknown";
  }

  return date.toLocaleDateString("en-GB", {
    day:"2-digit",
    month:"short",
    year:"numeric"
  });
};

function MemoryTimeline() {

  const [memories, setMemories] = useState([]);
  const [message, setMessage] = useState("");
  const [memoryToDelete, setMemoryToDelete] = useState(null);
  const [memoryToHide, setMemoryToHide] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [showFavorites, setShowFavorites] = useState(false);
  const [viewMode, setViewMode] = useState("timeline");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewMemory, setPreviewMemory] = useState(null);
  const [showReminderPanel, setShowReminderPanel] = useState(false);
  const [reminderPage, setReminderPage] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [activeReminder, setActiveReminder] = useState(null);
  const [reminderActionVersion, setReminderActionVersion] = useState(0);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [previewImageDetails, setPreviewImageDetails] = useState({});
  const [showPreviewImageDetails, setShowPreviewImageDetails] = useState(false);
  const [showPreviewImageViewer, setShowPreviewImageViewer] = useState(false);
  const [disablePreviewSharedLayout, setDisablePreviewSharedLayout] = useState(false);
  const [exportPanel, setExportPanel] = useState(null);
  const [selectedMemoryIds, setSelectedMemoryIds] = useState([]);
  const [exportCategory, setExportCategory] = useState("All");
  const [exportFromDate, setExportFromDate] = useState("");
  const [exportToDate, setExportToDate] = useState("");
  const [exportFavoritesOnly, setExportFavoritesOnly] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useState(()=>loadSettings());
  const [showSettingsTip, setShowSettingsTip] = useState(()=>(
    localStorage.getItem(SETTINGS_TIP_PENDING_KEY) === "true" &&
    localStorage.getItem(SETTINGS_TIP_DISMISSED_KEY) !== "true"
  ));
  const [isMobileTimeline, setIsMobileTimeline] = useState(()=>window.matchMedia("(max-width: 760px)").matches);
  const [virtualRange, setVirtualRange] = useState({
    start:0,
    end:30,
    beforeHeight:0,
    afterHeight:0
  });
  const [virtualMetrics, setVirtualMetrics] = useState({
    columns:5,
    rowHeight:330
  });

  const loadMoreRef = useRef(null);
  const timelineRef = useRef(null);
  const searchInputRef = useRef(null);
  const lastSoundReminderRef = useRef("");
  const reminderMenuRef = useRef(null);
  const filterMenuRef = useRef(null);
  const previewHistoryGuardRef = useRef(false);
  const previewDragRef = useRef(null);
  const previewHeadingRef = useRef(null);
  const previewReturnFocusRef = useRef(null);
  const memoriesRef = useRef([]);
  const handledReturnedPreviewRef = useRef("");
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const categories = ["All","Personal","Family","Friends","Travel","School","Work","Other"];
  const shouldVirtualizeTimeline = viewMode === "timeline" && memories.length > (isMobileTimeline ? 12 : 30);

  const loadMemories = useCallback(async (nextPage = 1, replace = false) => {
    setLoading(true);

    try{
      const res = await getMemories({
        page:nextPage,
        limit:isMobileTimeline ? 9 : 12,
        search:searchText || undefined,
        sort:sortOrder,
        category:categoryFilter,
        favorite:showFavorites ? "true" : undefined
      });

      setMemories(prevMemories => replace
        ? res.data.memories
        : [...prevMemories, ...res.data.memories]);
      setPage(res.data.page);
      setHasMore(res.data.hasMore);
    }finally{
      setLoading(false);
    }
  }, [categoryFilter, isMobileTimeline, searchText, showFavorites, sortOrder]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const handleChange = (event) => setIsMobileTimeline(event.matches);

    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    loadMemories(1, true);
  }, [loadMemories]);

  const measureTimeline = useCallback(() => {
    const timeline = timelineRef.current;

    if(!timeline){
      return;
    }

    const styles = window.getComputedStyle(timeline);
    const columns = styles.gridTemplateColumns
      .split(" ")
      .filter(Boolean)
      .length || 1;
    const rowGap = Number.parseFloat(styles.rowGap) || 0;
    const firstItem = timeline.querySelector(".timeline-item");
    const itemHeight = firstItem?.getBoundingClientRect().height || 300;

    setVirtualMetrics({
      columns,
      rowHeight:Math.max(160, itemHeight + rowGap)
    });
  }, []);

  const updateVirtualRange = useCallback(() => {
    if(!shouldVirtualizeTimeline || !timelineRef.current){
      setVirtualRange({
        start:0,
        end:memories.length,
        beforeHeight:0,
        afterHeight:0
      });
      return;
    }

    const timelineTop = timelineRef.current.getBoundingClientRect().top + window.scrollY;
    const viewportTop = window.scrollY;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const bufferHeight = viewportHeight * (isMobileTimeline ? 0.55 : 1.2);
    const firstVisibleY = Math.max(0, viewportTop - timelineTop - bufferHeight);
    const lastVisibleY = Math.max(firstVisibleY, viewportTop - timelineTop + viewportHeight + bufferHeight);
    const totalRows = Math.ceil(memories.length / virtualMetrics.columns);
    const startRow = Math.max(0, Math.floor(firstVisibleY / virtualMetrics.rowHeight));
    const endRow = Math.min(totalRows, Math.ceil(lastVisibleY / virtualMetrics.rowHeight) + 1);

    setVirtualRange({
      start:startRow * virtualMetrics.columns,
      end:Math.min(memories.length, endRow * virtualMetrics.columns),
      beforeHeight:startRow * virtualMetrics.rowHeight,
      afterHeight:Math.max(0, (totalRows - endRow) * virtualMetrics.rowHeight)
    });
  }, [isMobileTimeline, memories.length, shouldVirtualizeTimeline, virtualMetrics.columns, virtualMetrics.rowHeight]);

  useEffect(() => {
    measureTimeline();
    updateVirtualRange();

    const handleResize = () => {
      measureTimeline();
      updateVirtualRange();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [measureTimeline, updateVirtualRange, settings.cardSize]);

  useEffect(() => {
    if(!shouldVirtualizeTimeline){
      updateVirtualRange();
      return;
    }

    let frameId = 0;
    const handleScroll = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateVirtualRange);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, {passive:true});

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [shouldVirtualizeTimeline, updateVirtualRange]);

  useEffect(() => {
    if(!showReminderPanel && !showFilterMenu){
      return;
    }

    const closeOpenPanels = (event) => {
      const target = event.target;

      if(showReminderPanel && reminderMenuRef.current && !reminderMenuRef.current.contains(target)){
        setShowReminderPanel(false);
      }

      if(showFilterMenu && filterMenuRef.current && !filterMenuRef.current.contains(target)){
        setShowFilterMenu(false);
      }
    };

    document.addEventListener("pointerdown", closeOpenPanels);

    return () => {
      document.removeEventListener("pointerdown", closeOpenPanels);
    };
  }, [showFilterMenu, showReminderPanel]);

  useEffect(() => {
    const target = loadMoreRef.current;

    if(!target){
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if(entry.isIntersecting && hasMore && !loading){
        loadMemories(page + 1);
      }
    }, {threshold:0.4});

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasMore, loading, loadMemories, page]);

  const memoriesByMonth = useMemo(() => {
    return memories.reduce((groups, memory) => {
      const month = new Date(memory.date).toLocaleDateString("en-GB", {
        month:"long",
        year:"numeric"
      });

      if(!groups[month]){
        groups[month] = [];
      }

      groups[month].push(memory);
      return groups;
    }, {});
  }, [memories]);

  const upcomingReminders = useMemo(() => {
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const reminderWindowEnd = new Date();
    reminderWindowEnd.setDate(today.getDate() + Number(settings.reminderLeadDays || 2));

    return memories.filter((memory) => {
      if(!memory.reminderDate){
        return false;
      }

      const reminder = new Date(memory.reminderDate);
      const startReminder = new Date(reminder.getFullYear(), reminder.getMonth(), reminder.getDate());
      return startReminder >= startToday && startReminder <= reminderWindowEnd;
    });
  }, [memories, settings.reminderLeadDays]);

  const reminderPageSize = 5;
  const reminderPageCount = Math.max(1, Math.ceil(upcomingReminders.length / reminderPageSize));
  const pagedReminders = upcomingReminders.slice(
    reminderPage * reminderPageSize,
    reminderPage * reminderPageSize + reminderPageSize
  );

  const handleFavorite = async (id) => {
    const res = await toggleFavorite(id);
    setMemories(prevMemories => prevMemories.map(memory =>
      memory._id === id ? res.data : memory
    ));
  };

  const handleDeleteRequest = (memory, options = {}) => {
    if(!options.keepPreviewOpen){
      setPreviewMemory(null);
    }
    setMemoryToDelete(memory);
  };

  const closeDeleteDialog = () => {
    setMemoryToDelete(null);
  };

  const confirmDelete = async () => {

    if(!memoryToDelete){
      return;
    }

    const deletingPreviewMemory = previewMemory?._id === memoryToDelete._id;

    try {

      await deleteMemory(memoryToDelete._id);

      setMemories(prevMemories => {
        const updated = prevMemories.filter(memory => memory._id !== memoryToDelete._id);
        return [...updated];
      });

      setMemoryToDelete(null);
      if(deletingPreviewMemory){
        setPreviewMemory(null);
      }
      setMessage("Memory moved to bin");

    } catch (error) {

      console.error(error);
      setMemoryToDelete(null);
      setMessage("Failed to delete memory");

    }

  };

  const closeHideDialog = () => {
    setMemoryToHide(null);
  };

  const confirmHide = async () => {
    if(!memoryToHide){
      return;
    }

    try{
      await hideMemory(memoryToHide._id);
      setMemories(prevMemories => prevMemories.filter(memory => memory._id !== memoryToHide._id));
      if(previewMemory?._id === memoryToHide._id){
        setPreviewMemory(null);
      }
      setMemoryToHide(null);
      setMessage("Image hidden");
    }catch(err){
      setMessage(err.response?.data?.message || "Unable to hide image");
    }
  };

  const openHiddenImagesShortcut = () => {
    if(searchText.trim().toLowerCase() === "app/hide-image/"){
      setSearchText("");
      setShowSearch(false);
      navigate("/hide-image");
      return true;
    }

    return false;
  };

  const exportTimeline = () => {
    const rows = memories.map(memory => {
      const date = new Date(memory.date).toLocaleDateString("en-GB", {
        day:"2-digit",
        month:"short",
        year:"numeric"
      });
      const images = memory.images?.length ? memory.images : (memory.image ? [memory.image] : []);
      const imageMarkup = images.map((image, index) => `
        <img src="${getMemoryImageUrl(memory, "images", index) || getImageUrl(image)}" alt="${memory.title}" />
      `).join("");

      return `
        <section>
          <h2>${memory.title}</h2>
          <p><strong>${date}</strong> · ${memory.category || "Personal"}</p>
          <p>${memory.description}</p>
          <div class="images">${imageMarkup}</div>
        </section>
      `;
    }).join("");

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Memory Timeline</title>
          <style>
            body{font-family:Arial,sans-serif;padding:32px;color:#222;}
            h1{margin-bottom:24px;}
            section{border-bottom:1px solid #ddd;padding:18px 0;}
            .images{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px;}
            img{width:100%;max-height:280px;object-fit:cover;border-radius:10px;}
          </style>
        </head>
        <body>
          <h1>Memory Timeline</h1>
          ${rows || "<p>No memories to export.</p>"}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const shareCategory = async () => {
    if(categoryFilter === "All"){
      setMessage("Choose a category before sharing an album");
      return;
    }

    if(!window.confirm("Public share warning: anyone with this link can view these memories until the link expires. Continue?")){
      return;
    }

    try{
      const res = await createCategoryShare({category:categoryFilter});
      const url = `${window.location.origin}/share/${res.data.token}`;
      const result = await shareUrl({
        title:`${categoryFilter} Memories`,
        text:`Sharing my ${categoryFilter} memories from Memory Timeline`,
        url
      });

      if(result === "shared"){
        setMessage("Album share opened");
      }
      else if(result === "copied"){
        setMessage("Native sharing is unavailable. Album link copied instead");
      }
      else if(result === "manual"){
        setMessage("Copy the album link from the dialog");
      }
    }catch{
      setMessage("Album sharing failed");
    }
  };

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const fetchAllMemories = async (filters = {}) => {
    const allMemories = [];
    let nextPage = 1;
    let more = true;

    while(more){
      const res = await getMemories({
        page:nextPage,
        limit:30,
        sort:"oldest",
        category:filters.category || "All",
        favorite:filters.favorite ? "true" : undefined
      });

      allMemories.push(...res.data.memories);
      more = res.data.hasMore;
      nextPage += 1;
    }

    return allMemories.filter((memory) => {
      const memoryDate = new Date(memory.date);
      const fromMatches = !filters.fromDate || memoryDate >= new Date(`${filters.fromDate}T00:00:00`);
      const toMatches = !filters.toDate || memoryDate <= new Date(`${filters.toDate}T23:59:59`);
      return fromMatches && toMatches;
    });
  };

  const exportMemoriesAsHtml = async (items, label) => {
    if(!items.length){
      setMessage("No memories match this export");
      return;
    }

    setExporting(true);
    setMessage(`Preparing ${items.length} ${items.length === 1 ? "memory" : "memories"}...`);

    try{
      const rows = [];

      for(const memory of items){
        const images = getMemoryImages(memory);
        const embeddedImages = [];

        for(let index = 0; index < images.length; index += 1){
          try{
            const response = await downloadMemoryImage(memory._id, index);
            embeddedImages.push(await blobToDataUrl(response.data));
          }catch{
            embeddedImages.push("");
          }
        }

        const date = new Date(memory.date).toLocaleDateString("en-GB", {
          day:"2-digit",
          month:"short",
          year:"numeric"
        });
        const imageMarkup = embeddedImages.map((image, index) => `
          <img src="${image}" alt="${escapeHtml(memory.title)} image ${index + 1}" />
        `).join("");

        rows.push(`
          <article class="memory">
            <div class="memory-heading">
              <div>
                <span class="category">${escapeHtml(memory.category || "Personal")}</span>
                <h2>${escapeHtml(memory.title || "Untitled memory")}</h2>
              </div>
              <time>${date}</time>
            </div>
            <div class="description">${memory.description || ""}</div>
            ${imageMarkup ? `<div class="images">${imageMarkup}</div>` : ""}
          </article>
        `);
      }

      const documentMarkup = `<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width,initial-scale=1" />
            <title>${escapeHtml(label)}</title>
            <style>
              *{box-sizing:border-box}
              body{margin:0;padding:40px;background:#f7f4ff;color:#202039;font-family:Inter,Arial,sans-serif}
              main{width:min(1080px,100%);margin:auto}
              header{padding:32px;border-radius:24px;background:linear-gradient(135deg,#ff4b7d,#7468ff);color:white;margin-bottom:28px}
              header h1{margin:0 0 8px;font-size:38px}
              header p{margin:0;opacity:.86}
              .memory{padding:28px;margin:0 0 24px;border:1px solid #e6def7;border-radius:24px;background:white;box-shadow:0 16px 40px rgba(44,35,83,.1);break-inside:avoid}
              .memory-heading{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}
              h2{margin:10px 0 12px;font-size:28px}
              time{white-space:nowrap;color:#696580;font-weight:700}
              .category{display:inline-block;padding:6px 11px;border-radius:999px;background:#f2e9ff;color:#6a36b8;font-weight:800}
              .description{line-height:1.65;color:#4b4861}
              .images{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:20px}
              img{display:block;width:100%;max-height:520px;object-fit:cover;border-radius:16px;background:#eee}
              @media(max-width:680px){body{padding:18px}.images{grid-template-columns:1fr}.memory-heading{display:block}time{display:block;margin-bottom:8px}}
              @media print{body{padding:0;background:white}.memory{box-shadow:none}}
            </style>
          </head>
          <body>
            <main>
              <header>
                <h1>${escapeHtml(label)}</h1>
                <p>${items.length} ${items.length === 1 ? "memory" : "memories"} exported from Memory Timeline</p>
              </header>
              ${rows.join("")}
            </main>
          </body>
        </html>`;
      const blob = new Blob([documentMarkup], {type:"text/html;charset=utf-8"});
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      link.href = objectUrl;
      link.download = `${safeLabel || "memory-timeline"}-${new Date().toISOString().slice(0,10)}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setMessage("Memory export downloaded");
      setExportPanel(null);
      setSelectedMemoryIds([]);
    }catch(error){
      console.error(error);
      setMessage("Memory export failed");
    }finally{
      setExporting(false);
    }
  };

  const sanitizeFileName = (value) => (
    String(value || "")
      .split("")
      .filter((character) => character.charCodeAt(0) >= 32)
      .join("")
      .replace(/[<>:"/\\|?*]/g, "-")
  );

  const safeFilePart = (value, fallback = "memory") => (
    sanitizeFileName(value || fallback)
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || fallback
  );

  const getDownloadFileName = (response, memory, imageIndex) => {
    const disposition = response.headers["content-disposition"] || "";
    const utf8Name = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const quotedName = disposition.match(/filename="([^"]+)"/i)?.[1];
    const plainName = disposition.match(/filename=([^;]+)/i)?.[1]?.trim();
    const headerName = utf8Name ? decodeURIComponent(utf8Name) : quotedName || plainName;

    if(headerName){
      return sanitizeFileName(headerName);
    }

    const extension = response.data.type?.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    return `${safeFilePart(memory.title)}-${imageIndex + 1}.${extension}`;
  };

  const downloadBlob = (blob, fileName) => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const exportMemories = async (items, label) => {
    if(!items.length){
      setMessage("No memories match this export");
      return;
    }

    setExporting(true);
    setMessage(`Preparing images from ${items.length} ${items.length === 1 ? "memory" : "memories"}...`);

    try{
      const files = [];

      for(const memory of items){
        const images = getMemoryImages(memory);

        for(let imageIndex = 0; imageIndex < images.length; imageIndex += 1){
          const response = await downloadMemoryImage(memory._id, imageIndex);
          files.push({
            blob:response.data,
            name:getDownloadFileName(response, memory, imageIndex)
          });
        }
      }

      if(!files.length){
        setMessage("The selected memories do not contain images");
        return;
      }

      if(files.length === 1){
        downloadBlob(files[0].blob, files[0].name);
        setMessage("Image download started");
      }else{
        const zip = new JSZip();
        const usedNames = new Map();

        files.forEach(({blob, name}) => {
          const dotIndex = name.lastIndexOf(".");
          const baseName = dotIndex > 0 ? name.slice(0, dotIndex) : name;
          const extension = dotIndex > 0 ? name.slice(dotIndex) : "";
          const duplicateNumber = usedNames.get(name) || 0;
          const uniqueName = duplicateNumber ? `${baseName}-${duplicateNumber + 1}${extension}` : name;

          usedNames.set(name, duplicateNumber + 1);
          zip.file(uniqueName, blob);
        });

        const zipBlob = await zip.generateAsync({type:"blob", compression:"DEFLATE"});
        const zipName = `${safeFilePart(label, "memory-images")}-${new Date().toISOString().slice(0,10)}.zip`;
        downloadBlob(zipBlob, zipName);
        setMessage(`${files.length} images exported as ZIP`);
      }

      setExportPanel(null);
      setSelectedMemoryIds([]);
    }catch(error){
      console.error(error);
      setMessage("Memory export failed");
    }finally{
      setExporting(false);
    }
  };

  const handleExportAll = async () => {
    setExportPanel(null);
    await exportMemories(await fetchAllMemories(), "All Memories");
  };

  const toggleMemorySelection = (id) => {
    setSelectedMemoryIds((current) => current.includes(id)
      ? current.filter((memoryId) => memoryId !== id)
      : [...current, id]);
  };

  const handleExportSelected = async () => {
    const selected = memories.filter((memory) => selectedMemoryIds.includes(memory._id));
    await exportMemories(selected, "Selected Memories");
  };

  const handleFilteredExport = async () => {
    const filtered = await fetchAllMemories({
      category:exportCategory,
      fromDate:exportFromDate,
      toDate:exportToDate,
      favorite:exportFavoritesOnly
    });
    const label = exportCategory === "All" ? "Filtered Memories" : `${exportCategory} Memories`;
    await exportMemories(filtered, label);
  };

  void exportTimeline;
  void shareCategory;
  void exportMemoriesAsHtml;

  const shareMemory = async (memory) => {
    if(!window.confirm("Public share warning: anyone with this link can view this memory until the link expires. Continue?")){
      return;
    }

    try{
      const res = await createMemoryShare(memory._id);
      const url = `${window.location.origin}/share/${res.data.token}`;
      const result = await shareUrl({
        title:memory.title || "Memory Timeline",
        text:`Sharing "${memory.title || "this memory"}" from Memory Timeline`,
        url
      });

      if(result === "shared"){
        setMessage("Memory share opened");
      }
      else if(result === "copied"){
        setMessage("Native sharing is unavailable. Link copied instead");
      }
      else if(result === "manual"){
        setMessage("Copy the share link from the dialog");
      }
    }catch{
      setMessage("Memory sharing failed");
    }
  };

  const downloadPreviewImage = async () => {
    if(!previewMemory){
      return;
    }

    try{
      const response = await downloadMemoryImage(previewMemory._id, previewImageIndex);
      const blob = response.data;
      const objectUrl = URL.createObjectURL(blob);
      const safeTitle = previewMemory.title
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "memory";
      const disposition = response.headers["content-disposition"] || "";
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `${safeTitle}-${previewImageIndex + 1}.jpg`;
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      setMessage("Image download started");
    }catch{
      setMessage("Image download failed");
    }
  };

  const togglePreviewFavorite = async (memory) => {
    const res = await toggleFavorite(memory._id);
    setMemories(prevMemories => prevMemories.map(item =>
      item._id === memory._id ? res.data : item
    ));
    setPreviewMemory(res.data);
  };

  const getMemoryImages = (memory) => (
    getMemoryImageList(memory)
  );

  const showPreviousPreviewImage = () => {
    const images = getMemoryImages(previewMemory);
    setPreviewImageIndex(index => (index - 1 + images.length) % images.length);
  };

  const showNextPreviewImage = () => {
    const images = getMemoryImages(previewMemory);
    setPreviewImageIndex(index => (index + 1) % images.length);
  };

  const handlePreviewDragStart = (event) => {
    if(previewImages.length < 2){
      return;
    }

    previewDragRef.current = {
      x:event.clientX,
      y:event.clientY
    };
  };

  const handlePreviewDragEnd = (event) => {
    if(!previewDragRef.current || previewImages.length < 2){
      previewDragRef.current = null;
      return;
    }

    const deltaX = event.clientX - previewDragRef.current.x;
    const deltaY = event.clientY - previewDragRef.current.y;
    previewDragRef.current = null;

    if(Math.abs(deltaX) < 42 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2){
      return;
    }

    if(deltaX > 0){
      showPreviousPreviewImage();
    }
    else{
      showNextPreviewImage();
    }
  };

  const openPreviewMemory = (memory, sourceNode = null) => {
    previewReturnFocusRef.current = sourceNode || document.activeElement;
    setDisablePreviewSharedLayout(false);
    setPreviewMemory(memory);
    setPreviewImageIndex(0);
    setShowPreviewImageDetails(false);
  };

  const closePreviewToTimeline = () => {
    setDisablePreviewSharedLayout(false);
    setPreviewMemory(null);
    setShowPreviewImageDetails(false);
    navigate("/timeline", {replace:true, state:null});

    window.setTimeout(() => {
      previewReturnFocusRef.current?.focus?.();
    }, prefersReducedMotion ? 180 : 720);
  };

  const previewDeleteActive = Boolean(
    memoryToDelete && previewMemory && memoryToDelete._id === previewMemory._id
  );
  const previewImages = previewMemory ? getMemoryImages(previewMemory) : [];
  const hasMultiplePreviewImages = previewImages.length > 1;
  const currentPreviewImage = previewImages[previewImageIndex] || previewImages[0];
  const previewImageDetailsKey = previewMemory ? `${previewMemory._id}-${previewImageIndex}` : "";
  const currentPreviewImageDetails = previewImageDetails[previewImageDetailsKey] || {};
  const previewImageResolution = currentPreviewImageDetails.width && currentPreviewImageDetails.height
    ? `${currentPreviewImageDetails.width} x ${currentPreviewImageDetails.height}`
    : "Loading";
  const previewImageType = getImageTypeLabel(currentPreviewImageDetails.type, currentPreviewImage);
  const previewImageSize = currentPreviewImageDetails.loading
    ? "Loading"
    : formatImageBytes(currentPreviewImageDetails.size);
  const previewImageAddedDate = formatImageAddedDate(previewMemory?.createdAt || previewMemory?.updatedAt || previewMemory?.date);

  useAutoDismissMessage(message, setMessage);

  useEffect(() => {
    const returnedPreview = location.state?.previewMemory;
    const shouldShowSettingsTip = location.state?.showSettingsTip;

    if(returnedPreview){
      const returnedPreviewMediaKey = [
        returnedPreview.image,
        ...(returnedPreview.images || []),
        ...(returnedPreview.thumbnails || [])
      ].join("|");
      const returnedPreviewKey = `${returnedPreview._id || "memory"}-${returnedPreview.updatedAt || returnedPreviewMediaKey}`;

      if(handledReturnedPreviewRef.current === returnedPreviewKey){
        navigate(location.pathname, {replace:true, state:null});
        return;
      }

      handledReturnedPreviewRef.current = returnedPreviewKey;

      const existingPreviewMemory = memoriesRef.current.find(memory => memory._id === returnedPreview._id);
      const mergedPreview = mergeMemoryWithExistingMedia(returnedPreview, existingPreviewMemory);

      setDisablePreviewSharedLayout(true);
      setPreviewImageIndex(0);
      setShowPreviewImageDetails(false);
      setMemories(prevMemories => prevMemories.map(memory =>
        memory._id === returnedPreview._id
          ? mergeMemoryWithExistingMedia(returnedPreview, memory)
          : memory
      ));
      setPreviewMemory(mergedPreview);
      navigate(location.pathname, {replace:true, state:null});
    }

    if(shouldShowSettingsTip && localStorage.getItem(SETTINGS_TIP_DISMISSED_KEY) !== "true"){
      localStorage.setItem(SETTINGS_TIP_PENDING_KEY, "true");
      setShowSettingsTip(true);
      navigate(location.pathname, {replace:true, state:null});
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if(reminderPage >= reminderPageCount){
      setReminderPage(reminderPageCount - 1);
    }
  }, [reminderPage, reminderPageCount]);

  useEffect(() => {
    setPreviewImageIndex(0);
  }, [previewMemory?._id]);

  useEffect(() => {
    setShowPreviewImageDetails(false);
  }, [previewMemory?._id, previewImageIndex]);

  useEffect(() => {
    if(!previewMemory){
      setShowPreviewImageViewer(false);
    }
  }, [previewMemory]);

  useEffect(() => {
    if(!showPreviewImageViewer){
      return;
    }

    const handleViewerKeyDown = (event) => {
      if(event.key === "Escape"){
        setShowPreviewImageViewer(false);
      }

      if(event.key === "ArrowLeft" && hasMultiplePreviewImages){
        showPreviousPreviewImage();
      }

      if(event.key === "ArrowRight" && hasMultiplePreviewImages){
        showNextPreviewImage();
      }
    };

    window.addEventListener("keydown", handleViewerKeyDown);
    return () => window.removeEventListener("keydown", handleViewerKeyDown);
  }, [hasMultiplePreviewImages, showPreviewImageViewer]);

  useEffect(() => {
    if(!previewMemory){
      return;
    }

    const focusDelay = prefersReducedMotion ? 60 : 520;
    const focusTimer = window.setTimeout(() => {
      previewHeadingRef.current?.focus?.();
    }, focusDelay);

    return () => window.clearTimeout(focusTimer);
  }, [prefersReducedMotion, previewMemory]);

  useEffect(() => {
    if(!previewMemory){
      previewHistoryGuardRef.current = false;
      return;
    }

    if(!previewHistoryGuardRef.current){
      previewHistoryGuardRef.current = true;
      window.history.pushState({memoryPreviewBackGuard:true}, "", window.location.href);
    }

    const handlePreviewBrowserBack = () => {
      previewHistoryGuardRef.current = false;
      setPreviewMemory(null);
      navigate("/timeline", {replace:true});
    };

    window.addEventListener("popstate", handlePreviewBrowserBack);

    return () => {
      window.removeEventListener("popstate", handlePreviewBrowserBack);
    };
  }, [navigate, previewMemory]);

  useEffect(() => {
    if(showSearch){
      searchInputRef.current?.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    const handleSettingsUpdated = (event) => {
      setSettings(event.detail || loadSettings());
    };

    window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    window.addEventListener(SETTINGS_PREVIEW_EVENT, handleSettingsUpdated);
    window.addEventListener("storage", handleSettingsUpdated);

    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
      window.removeEventListener(SETTINGS_PREVIEW_EVENT, handleSettingsUpdated);
      window.removeEventListener("storage", handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);

  const activePreviewOverlayVariants = prefersReducedMotion
    ? {
      hidden:{opacity:0},
      visible:{opacity:1, transition:{duration:0.15, ease:"easeOut"}},
      exit:{opacity:0, transition:{duration:0.15, ease:"easeOut"}}
    }
    : previewOverlayVariants;
  const activePreviewDialogVariants = prefersReducedMotion
    ? {
      hidden:{opacity:0},
      visible:{
        opacity:1,
        transition:{
          duration:0.15,
          ease:"easeOut",
          when:"beforeChildren",
          staggerChildren:0.02
        }
      },
      exit:{opacity:0, transition:{duration:0.15, ease:"easeOut"}}
    }
    : previewDialogVariants;
  const activePreviewContentChildVariants = prefersReducedMotion
    ? {
      hidden:{opacity:0},
      visible:{opacity:1, transition:{duration:0.15, ease:"easeOut"}}
    }
    : previewContentChildVariants;
  const visibleTimelineMemories = shouldVirtualizeTimeline
    ? memories.slice(virtualRange.start, virtualRange.end)
    : memories;
  const nextViewMode = VIEW_MODES[(VIEW_MODES.indexOf(viewMode) + 1) % VIEW_MODES.length];
  const renderSmallMemoryCard = (memory, className = "calendar-memory") => {
    const memoryDate = new Date(memory.date);
    const memoryImages = getMemoryImages(memory);
    const cardImages = memory.thumbnails?.length ? memory.thumbnails : memoryImages;
    const cardImageKind = memory.thumbnails?.length ? "thumbnails" : "images";
    const isCompactCard = className.includes("small-container-memory");
    const formattedDate = memoryDate.toLocaleDateString("en-GB", {
      day:"2-digit",
      month:"short",
      year:"numeric"
    });

    return (
      <button
        key={memory._id}
        className={`${className} ${selectedMemoryIds.includes(memory._id) ? "selected" : ""}`}
        onClick={()=>{
          if(exportPanel === "selected"){
            toggleMemorySelection(memory._id);
          }else{
            setPreviewMemory(memory);
          }
        }}
      >
        {exportPanel === "selected" && (
          <i aria-hidden="true">{selectedMemoryIds.includes(memory._id) ? "\u2713" : ""}</i>
        )}
        <span className={`calendar-memory-thumbnail ${cardImages[0] ? "" : "empty"}`}>
          {cardImages[0] ? (
            <SmartImage
              src={getMemoryImageUrl(memory, cardImageKind, 0)}
              alt=""
              detectFaces={false}
            />
          ) : (
            <strong>{memory.title?.slice(0,1) || "M"}</strong>
          )}
        </span>
        {!isCompactCard && (
          <>
            <span className="calendar-memory-copy">
              <strong>{memory.title}</strong>
              <span className="calendar-memory-meta">
                <time dateTime={memory.date}>{formattedDate}</time>
              </span>
            </span>
            <span className="calendar-memory-arrow" aria-hidden="true">&#8594;</span>
          </>
        )}
      </button>
    );
  };
  const dismissSettingsTip = () => {
    localStorage.setItem(SETTINGS_TIP_DISMISSED_KEY, "true");
    localStorage.removeItem(SETTINGS_TIP_PENDING_KEY);
    setShowSettingsTip(false);
  };

  const loadPreviewImageDetails = async () => {
    if(!previewMemory || !currentPreviewImage || !previewImageDetailsKey){
      return;
    }

    const existingDetails = previewImageDetails[previewImageDetailsKey];

    if(existingDetails?.size && existingDetails?.type){
      return;
    }

    setPreviewImageDetails(current => ({
      ...current,
      [previewImageDetailsKey]:{
        ...current[previewImageDetailsKey],
        loading:true
      }
    }));

    try{
      const response = await fetch(getMemoryImageUrl(previewMemory, "images", previewImageIndex), {
        credentials:"include"
      });

      if(!response.ok){
        throw new Error("Image details failed");
      }

      const blob = await response.blob();

      setPreviewImageDetails(current => ({
        ...current,
        [previewImageDetailsKey]:{
          ...current[previewImageDetailsKey],
          loading:false,
          size:blob.size,
          type:blob.type
        }
      }));
    }catch{
      setPreviewImageDetails(current => ({
        ...current,
        [previewImageDetailsKey]:{
          ...current[previewImageDetailsKey],
          loading:false
        }
      }));
    }
  };

  const togglePreviewImageDetails = (event) => {
    event.stopPropagation();

    setShowPreviewImageDetails(current => {
      const next = !current;

      if(next){
        void loadPreviewImageDetails();
      }

      return next;
    });
  };

  const getReminderKey = (memory) => (
    `memory-reminder-${memory._id}-${memory.reminderDate?.split("T")[0] || ""}`
  );

  const getTodayKey = (date = new Date()) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${date.getFullYear()}-${month}-${day}`;
  };

  const getDaysUntilReminder = (reminderDate) => {
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const reminder = new Date(reminderDate);
    const startReminder = new Date(reminder.getFullYear(), reminder.getMonth(), reminder.getDate());

    return Math.round((startReminder - startToday) / (1000 * 60 * 60 * 24));
  };

  useEffect(() => {
    const reminder = memories.find((memory) => {
      if(!memory.reminderDate){
        return false;
      }

      const reminderKey = getReminderKey(memory);
      const dismissedDate = localStorage.getItem(`${reminderKey}-dismissed-date`);

      if(dismissedDate === getTodayKey()){
        return false;
      }

      const daysUntilReminder = getDaysUntilReminder(memory.reminderDate);

      if(daysUntilReminder < 0){
        return false;
      }

      const snoozedUntil = localStorage.getItem(`${reminderKey}-snoozed-until`);
      const snoozeDue = snoozedUntil && snoozedUntil <= getTodayKey();

      return snoozeDue || (!snoozedUntil && daysUntilReminder <= Number(settings.reminderLeadDays || 2));
    });

    setActiveReminder(reminder || null);
  }, [memories, reminderActionVersion, settings.reminderLeadDays]);

  const dismissReminderToday = () => {
    if(!activeReminder){
      return;
    }

    localStorage.setItem(`${getReminderKey(activeReminder)}-dismissed-date`, getTodayKey());
    setActiveReminder(null);
    setReminderActionVersion(version => version + 1);
  };

  const remindTomorrow = () => {
    if(!activeReminder){
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    localStorage.setItem(`${getReminderKey(activeReminder)}-snoozed-until`, getTodayKey(tomorrow));
    setActiveReminder(null);
    setReminderActionVersion(version => version + 1);
  };

  useEffect(() => {
    if(!activeReminder){
      return;
    }

    const reminderKey = getReminderKey(activeReminder);

    if(lastSoundReminderRef.current === reminderKey){
      return;
    }

    lastSoundReminderRef.current = reminderKey;
    playAppSound("reminder");
  }, [activeReminder]);

  return (

    <LayoutGroup id="memory-preview-shared-transition">

    <PageTransition>

      <div className="timeline-container">

        {message && (
          <div className="toast">
            {message}
          </div>
        )}

        <div className="reminder-menu" ref={reminderMenuRef}>
          <button
            type="button"
            className="reminder-icon-btn"
            aria-label="Show reminders"
            onClick={()=>{
              setShowReminderPanel(!showReminderPanel);
              setReminderPage(0);
            }}
          >
            🔔
            {upcomingReminders.length > 0 && (
              <span>{upcomingReminders.length}</span>
            )}
          </button>

          {showReminderPanel && (
            <>
            <div className="mobile-popover-backdrop" aria-hidden="true" />
            <div className="reminder-popover">
              <h3>Reminders</h3>
              {upcomingReminders.length > 0 ? (
                <>
                  {pagedReminders.map((memory)=>(
                    <button
                      type="button"
                      className="reminder-popover-item"
                      key={memory._id}
                      onClick={()=>{
                        openPreviewMemory(memory);
                        setShowReminderPanel(false);
                      }}
                    >
                      <strong>{memory.title}</strong>
                      <small>
                        {new Date(memory.reminderDate).toLocaleDateString("en-GB", {
                          day:"2-digit",
                          month:"short",
                          year:"numeric"
                        })}
                      </small>
                    </button>
                  ))}

                  {reminderPageCount > 1 && (
                    <div className="reminder-pagination">
                      <button
                        type="button"
                        aria-label="Previous reminders"
                        disabled={reminderPage === 0}
                        onClick={()=>setReminderPage(page => Math.max(0, page - 1))}
                      >
                        ‹
                      </button>
                      <span>{reminderPage + 1} / {reminderPageCount}</span>
                      <button
                        type="button"
                        aria-label="Next reminders"
                        disabled={reminderPage >= reminderPageCount - 1}
                        onClick={()=>setReminderPage(page => Math.min(reminderPageCount - 1, page + 1))}
                      >
                        ›
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <p>No reminders this week</p>
              )}
            </div>
            </>
          )}
        </div>

        <button
          type="button"
          className="timeline-title timeline-title-button"
          onClick={()=>navigate("/about")}
          aria-label="Open About Memory Timeline"
          title="About Memory Timeline"
        >
          Memory Timeline
        </button>

        <div className="timeline-controls-shell">
          <div className={`timeline-controls toolbar-icons-${settings.toolbarIconStyle || "box"}`}>
          <div className={`timeline-search-shell ${showSearch || searchText ? "open" : ""}`}>
            <button
              type="button"
              className="timeline-icon-control"
              title="Search memories"
              aria-label="Search memories"
              aria-expanded={showSearch || Boolean(searchText)}
              onClick={()=>{
                const shouldClose = showSearch || searchText;
                setShowSearch(!shouldClose);
                if(shouldClose){
                  setSearchText("");
                }
              }}
            >
              &#128269;
            </button>

            <input
              ref={searchInputRef}
              className="timeline-search"
              type="search"
              placeholder="Search memories"
              value={searchText}
              onChange={(e)=>setSearchText(e.target.value)}
              onKeyDown={(event)=>{
                if(event.key === "Enter"){
                  openHiddenImagesShortcut();
                }
              }}
              onFocus={()=>setShowSearch(true)}
              tabIndex={showSearch || searchText ? 0 : -1}
            />
            {(showSearch || searchText) && (
              <button
                type="button"
                className="timeline-search-go"
                aria-label="Open typed location"
                title="Open typed location"
                onClick={openHiddenImagesShortcut}
              >
                &#8594;
              </button>
            )}
          </div>

          <div className="timeline-filter-menu" ref={filterMenuRef}>
            <button
              type="button"
              className={`timeline-icon-control filter-icon-control ${showFilterMenu || sortOrder !== "newest" || categoryFilter !== "All" ? "active" : ""}`}
              title="Filter memories"
              aria-label="Filter memories"
              aria-expanded={showFilterMenu}
              onClick={()=>setShowFilterMenu(!showFilterMenu)}
            >
              <span className="filter-funnel-icon" aria-hidden="true" />
            </button>

            {showFilterMenu && (
              <>
              <div className="mobile-popover-backdrop" aria-hidden="true" />
              <div className="timeline-filter-popover">
                <div className="timeline-filter-section">
                  <span>Sort</span>
                  <button
                    type="button"
                    className={sortOrder === "newest" ? "selected" : ""}
                    onClick={()=>setSortOrder("newest")}
                  >
                    New to old
                  </button>
                  <button
                    type="button"
                    className={sortOrder === "oldest" ? "selected" : ""}
                    onClick={()=>setSortOrder("oldest")}
                  >
                    Old to new
                  </button>
                </div>

                <div className="timeline-filter-section">
                  <span>Category</span>
                  {categories.map((category)=>(
                    <button
                      type="button"
                      key={category}
                      className={categoryFilter === category ? "selected" : ""}
                      onClick={()=>setCategoryFilter(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
              </>
            )}
          </div>

          <button
            type="button"
            className={`filter-toggle ${showFavorites ? "active" : ""}`}
            title="Favorites"
            aria-label="Favorites"
            onClick={()=>setShowFavorites(!showFavorites)}
          >
            ⭐
          </button>
        
          <button
            type="button"
            className="timeline-action-btn"
            title="Add New Memory"
            aria-label="Add New Memory"
            onClick={() => navigate("/add")}
          >
            ➕
          </button>
          <button
            type="button"
            className="timeline-action-btn"
            title={`Switch to ${VIEW_MODE_LABELS[nextViewMode]}`}
            aria-label={`Switch to ${VIEW_MODE_LABELS[nextViewMode]}`}
            onClick={()=>setViewMode(nextViewMode)}
          >
            {VIEW_MODE_ICONS[nextViewMode]}
          </button>
          <button
            type="button"
            className={`timeline-action-btn export-image-btn ${exportPanel ? "active" : ""}`}
            title="Export memories"
            aria-label="Export memories"
            aria-expanded={Boolean(exportPanel)}
            onClick={()=>setExportPanel(exportPanel ? null : "menu")}
          >
          </button>
          <button
            type="button"
            className="timeline-action-btn trash-nav-btn"
            title="Trash"
            aria-label="Trash"
            onClick={() => navigate("/trash")}
          >
            🗑️
          </button>
          <button
            type="button"
            className="timeline-action-btn"
            title="Settings"
            aria-label="Settings"
            onClick={() => navigate("/profile")}
          >
            👤
          </button>
          </div>

          {showSettingsTip && (
            <div className="settings-tip-bubble" role="status">
              <span>You can customize your own memory view here.</span>
              <button
                type="button"
                aria-label="Dismiss settings tip"
                onClick={dismissSettingsTip}
              >
                &#10003;
              </button>
            </div>
          )}

          {exportPanel === "menu" && (
            <div className="timeline-export-popover">
              <button type="button" onClick={handleExportAll}>
                <strong>Export all</strong>
                <small>Download every memory</small>
              </button>
              <button
                type="button"
                onClick={()=>{
                  setSelectedMemoryIds([]);
                  setExportPanel("selected");
                }}
              >
                <strong>Export selected</strong>
                <small>Choose memories from the timeline</small>
              </button>
              <button type="button" onClick={()=>setExportPanel("filter")}>
                <strong>Export by filter</strong>
                <small>Category, date, or favorites</small>
              </button>
            </div>
          )}
        </div>

        {exportPanel === "selected" && (
          <div className="export-selection-bar">
            <div>
              <strong>Select memories to export</strong>
              <span>{selectedMemoryIds.length} selected</span>
            </div>
            <div className="export-selection-actions">
              <button
                type="button"
                onClick={()=>setSelectedMemoryIds(
                  selectedMemoryIds.length === memories.length ? [] : memories.map((memory)=>memory._id)
                )}
              >
                {selectedMemoryIds.length === memories.length && memories.length ? "Clear all" : "Select visible"}
              </button>
              <button
                type="button"
                className="export-cancel-btn"
                onClick={()=>{
                  setExportPanel(null);
                  setSelectedMemoryIds([]);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="export-confirm-btn"
                disabled={!selectedMemoryIds.length || exporting}
                onClick={handleExportSelected}
              >
                {exporting ? "Preparing..." : "Export"}
              </button>
            </div>
          </div>
        )}

        {memories.length === 0 && !loading ? (
          <div className="empty-state">
            <h3>No Memories Yet</h3>
            <p>Start your timeline with a moment worth keeping.</p>
            <button onClick={() => navigate("/add")}>
              Add First Memory
            </button>
          </div>
        ) : viewMode === "calendar" ? (
          <div className="calendar-view">
            {Object.entries(memoriesByMonth).map(([month, items])=>(
              <div className="calendar-month" key={month}>
                <div className="calendar-month-heading">
                  <div>
                    <span className="calendar-month-kicker">Memory collection</span>
                    <h3>{month}</h3>
                  </div>
                  <span className="calendar-month-count">
                    {items.length} {items.length === 1 ? "memory" : "memories"}
                  </span>
                </div>
                <div className="calendar-grid">
                  {items.map((memory)=>renderSmallMemoryCard(memory, "calendar-memory small-container-memory calendar-image-memory"))}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "compact" ? (
          <div className="small-cards-view">
            {memories.map((memory)=>renderSmallMemoryCard(memory, "calendar-memory small-container-memory"))}
          </div>
        ) : (

          <div className="timeline" ref={timelineRef}>
            {shouldVirtualizeTimeline && virtualRange.beforeHeight > 0 && (
              <div
                className="timeline-virtual-spacer"
                style={{height:virtualRange.beforeHeight}}
                aria-hidden="true"
              />
            )}

            {visibleTimelineMemories.map((memory, index) => (
              <MemoryCard
                key={memory._id}
                memory={memory}
                index={virtualRange.start + index}
                onDelete={handleDeleteRequest}
                onFavorite={handleFavorite}
                onPreview={openPreviewMemory}
                isTransitionDimmed={Boolean(previewMemory) && previewMemory._id !== memory._id}
                isTransitionSource={!disablePreviewSharedLayout && previewMemory?._id === memory._id}
                selectionMode={exportPanel === "selected"}
                selected={selectedMemoryIds.includes(memory._id)}
                onSelect={toggleMemorySelection}
              />
            ))}

            {shouldVirtualizeTimeline && virtualRange.afterHeight > 0 && (
              <div
                className="timeline-virtual-spacer"
                style={{height:virtualRange.afterHeight}}
                aria-hidden="true"
              />
            )}
          </div>

        )}

        <div ref={loadMoreRef} className="load-more-sentinel">
          {loading && "Loading memories..."}
          {!loading && hasMore && (
            <button onClick={()=>loadMemories(page + 1)}>
              Load More
            </button>
          )}
        </div>

      </div>

    </PageTransition>

    {exportPanel === "filter" && (
      <div className="export-filter-overlay" onClick={()=>setExportPanel(null)}>
        <div className="export-filter-dialog" onClick={(event)=>event.stopPropagation()}>
          <div className="export-filter-heading">
            <div>
              <span>Custom export</span>
              <h3>Export by filter</h3>
            </div>
            <button type="button" aria-label="Close export filters" onClick={()=>setExportPanel(null)}>
              &#10005;
            </button>
          </div>

          <label>
            Category
            <select value={exportCategory} onChange={(event)=>setExportCategory(event.target.value)}>
              {categories.map((category)=><option key={category} value={category}>{category}</option>)}
            </select>
          </label>

          <div className="export-date-fields">
            <label>
              From date
              <input type="date" value={exportFromDate} onChange={(event)=>setExportFromDate(event.target.value)} />
            </label>
            <label>
              To date
              <input type="date" value={exportToDate} onChange={(event)=>setExportToDate(event.target.value)} />
            </label>
          </div>

          <label className="export-favorite-option">
            <input
              type="checkbox"
              checked={exportFavoritesOnly}
              onChange={(event)=>setExportFavoritesOnly(event.target.checked)}
            />
            Favorites only
          </label>

          <div className="export-filter-actions">
            <button type="button" className="export-cancel-btn" onClick={()=>setExportPanel(null)}>
              Cancel
            </button>
            <button type="button" className="export-confirm-btn" disabled={exporting} onClick={handleFilteredExport}>
              {exporting ? "Preparing..." : "Export memories"}
            </button>
          </div>
        </div>
      </div>
    )}

    {activeReminder && (
      <div className="reminder-alert-overlay">
        <div className="reminder-alert-card" role="dialog" aria-modal="true">
          <span className="reminder-alert-icon" aria-hidden="true">
            &#128276;
          </span>
          <p className="reminder-alert-kicker">Reminder coming up</p>
          <h3>{activeReminder.title}</h3>
          <p>
            This memory is scheduled for{" "}
            <strong>
              {new Date(activeReminder.reminderDate).toLocaleDateString("en-GB", {
                day:"2-digit",
                month:"short",
                year:"numeric"
              })}
            </strong>
            . Reminder messages start {settings.reminderLeadDays} day{Number(settings.reminderLeadDays) === 1 ? "" : "s"} before.
          </p>
          <div className="reminder-alert-actions">
            <button type="button" className="reminder-ignore-btn" onClick={dismissReminderToday}>
              Dismiss today
            </button>
            <button type="button" className="reminder-tomorrow-btn" onClick={remindTomorrow}>
              Remind me tomorrow
            </button>
          </div>
        </div>
      </div>
    )}

    <AnimatePresence>
    {previewMemory && (
      <motion.div
        key={previewMemory._id}
        className="preview-overlay"
        variants={activePreviewOverlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={()=>{
          if(!previewDeleteActive){
            closePreviewToTimeline();
          }
        }}
      >
        <motion.div
          className="preview-dialog"
          layout={!prefersReducedMotion}
          variants={activePreviewDialogVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(event)=>{
            event.stopPropagation();
            setShowPreviewImageDetails(false);
          }}
        >
          <button
            type="button"
            className="preview-back-btn"
            aria-label="Back to all memories"
            onClick={closePreviewToTimeline}
          >
            &#8592;
          </button>

          <motion.div
            className={`preview-media ${hasMultiplePreviewImages ? "multiple-images" : "single-image"}`}
            layoutId={prefersReducedMotion || disablePreviewSharedLayout ? undefined : `memory-image-${previewMemory._id}`}
            transition={memorySharedLayoutTransition}
            onPointerDown={hasMultiplePreviewImages ? handlePreviewDragStart : undefined}
            onPointerUp={hasMultiplePreviewImages ? handlePreviewDragEnd : undefined}
            onPointerCancel={hasMultiplePreviewImages ? ()=>{ previewDragRef.current = null; } : undefined}
          >
            {currentPreviewImage && (
              <SmartImage
                key={`${currentPreviewImage}-preview-${previewImageIndex}`}
                className="preview-carousel-image"
                src={getMemoryImageUrl(previewMemory, "images", previewImageIndex)}
                alt={previewMemory.title}
                draggable={false}
                onBlobReady={(blob)=>{
                  setPreviewImageDetails(current => ({
                    ...current,
                    [previewImageDetailsKey]:{
                      ...current[previewImageDetailsKey],
                      loading:false,
                      size:blob.size,
                      type:blob.type
                    }
                  }));
                }}
                onLoad={(event)=>{
                  const image = event.currentTarget;

                  setPreviewImageDetails(current => ({
                    ...current,
                    [previewImageDetailsKey]:{
                      ...current[previewImageDetailsKey],
                      width:image.naturalWidth,
                      height:image.naturalHeight
                    }
                  }));
                }}
              />
            )}

            {currentPreviewImage && (
              <button
                type="button"
                className="preview-image-expand-btn"
                title="Open image"
                aria-label="Open image"
                onClick={(event)=>{
                  event.stopPropagation();
                  setShowPreviewImageViewer(true);
                }}
              >
                <span aria-hidden="true">&#9974;</span>
              </button>
            )}

            {hasMultiplePreviewImages && (
              <>
                <button
                  type="button"
                  className="preview-image-nav left"
                  aria-label="Previous image"
                  onClick={showPreviousPreviewImage}
                >
                  &#8249;
                </button>
                <button
                  type="button"
                  className="preview-image-nav right"
                  aria-label="Next image"
                  onClick={showNextPreviewImage}
                >
                  &#8250;
                </button>
                <span className="preview-image-count">
                  {previewImageIndex + 1} / {previewImages.length}
                </span>
              </>
            )}
          </motion.div>

          <motion.div className="preview-content">
            <motion.h3
              ref={previewHeadingRef}
              tabIndex="-1"
              layoutId={prefersReducedMotion ? undefined : `memory-title-${previewMemory._id}`}
              transition={memorySharedLayoutTransition}
            >
              {previewMemory.title}
            </motion.h3>
            <motion.div
              className={`preview-description ${previewMemory.description ? "" : "empty"}`}
              variants={activePreviewContentChildVariants}
              dangerouslySetInnerHTML={{
                __html:previewMemory.description || "<p>No description added for this memory.</p>"
              }}
            />
            <motion.div
              className="preview-actions"
              variants={activePreviewContentChildVariants}
            >
              {currentPreviewImage && (
                <span className="preview-image-info-wrap">
                  <button
                    type="button"
                    title="Image details"
                    aria-label="Image details"
                    className="preview-image-info-btn"
                    aria-expanded={showPreviewImageDetails}
                    onClick={togglePreviewImageDetails}
                  >
                    <span aria-hidden="true">i</span>
                  </button>
                  {showPreviewImageDetails && (
                    <span className="preview-image-info-popover">
                      <strong className="preview-image-info-title">Memory details</strong>
                      <span className="preview-image-info-row">
                        <span>Category</span>
                        <strong>{previewMemory.category || "Personal"}</strong>
                      </span>
                      <span className="preview-image-info-row">
                        <span>Memory date</span>
                        <strong>{new Date(previewMemory.date).toLocaleDateString("en-GB", {
                          day:"2-digit",
                          month:"short",
                          year:"numeric"
                        })}</strong>
                      </span>
                      <span className="preview-image-info-row">
                        <span>Image type</span>
                        <strong>{previewImageType}</strong>
                      </span>
                      <span className="preview-image-info-row">
                        <span>Date added</span>
                        <strong>{previewImageAddedDate}</strong>
                      </span>
                      <span className="preview-image-info-row">
                        <span>Size</span>
                        <strong>{previewImageSize}</strong>
                      </span>
                      <span className="preview-image-info-row">
                        <span>Resolution</span>
                        <strong>{previewImageResolution}</strong>
                      </span>
                    </span>
                  )}
                </span>
              )}
              <button
                type="button"
                title="Edit"
                aria-label="Edit"
                onClick={()=>navigate("/add", {state:{...previewMemory, returnToPreview:true}})}
              >
                <span aria-hidden="true">✎</span>
              </button>
              <button
                type="button"
                title="Favorite"
                aria-label="Favorite"
                className={`preview-favorite-btn ${previewMemory.favorite ? "active" : ""}`}
                onClick={()=>togglePreviewFavorite(previewMemory)}
              >
                <span aria-hidden="true">{previewMemory.favorite ? "\u2605" : "\u2606"}</span>
              </button>
              <button
                type="button"
                title="Share"
                aria-label="Share"
                onClick={()=>shareMemory(previewMemory)}
              >
                <span aria-hidden="true">➤</span>
              </button>
              <button
                type="button"
                className="preview-export-btn"
                title="Download image"
                aria-label="Download image"
                onClick={downloadPreviewImage}
              >
                <span aria-hidden="true">🡻</span>
              </button>
              <button
                type="button"
                className="preview-hide-btn"
                title="Hide image"
                aria-label="Hide image"
                onClick={()=>setMemoryToHide(previewMemory)}
              >
                <span className="hide-eye-emoji" aria-hidden="true">&#128065;</span>
              </button>
              <button
                type="button"
                className="preview-delete-btn"
                title="Delete"
                aria-label="Delete"
                onClick={()=>handleDeleteRequest(previewMemory, {keepPreviewOpen:true})}
              >
                <span aria-hidden="true">🗑️</span>
              </button>
            </motion.div>
          </motion.div>

          {previewDeleteActive && (
            <div className="preview-confirm">
              <div className="preview-confirm-dialog">
                <h3>Move to bin?</h3>
                <p>
                  "{memoryToDelete.title}" will stay in trash for 30 days before it is permanently deleted.
                </p>
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="cancel-delete-btn"
                    onClick={closeDeleteDialog}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="confirm-delete-btn"
                    onClick={confirmDelete}
                  >
                    Move to bin
                  </button>
                </div>
              </div>
            </div>
          )}

          {memoryToHide && previewMemory && memoryToHide._id === previewMemory._id && (
            <div className="preview-confirm">
              <div className="preview-confirm-dialog hide-confirm-dialog">
                <h3>Hide this image?</h3>
                <p>
                  "{memoryToHide.title}" will move out of your normal timeline. You can open hidden images with app/hide-image/.
                </p>
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="cancel-delete-btn"
                    onClick={closeHideDialog}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="confirm-hide-btn"
                    onClick={confirmHide}
                  >
                    Hide
                  </button>
                </div>
              </div>
            </div>
          )}

          {showPreviewImageViewer && currentPreviewImage && (
            <div
              className={`carousel-overlay preview-image-viewer ${hasMultiplePreviewImages ? "multiple-images" : "single-image"}`}
              role="dialog"
              aria-modal="true"
              aria-label={`${previewMemory.title} image viewer`}
              onClick={()=>setShowPreviewImageViewer(false)}
              onPointerDown={hasMultiplePreviewImages ? handlePreviewDragStart : undefined}
              onPointerUp={hasMultiplePreviewImages ? handlePreviewDragEnd : undefined}
              onPointerCancel={hasMultiplePreviewImages ? ()=>{ previewDragRef.current = null; } : undefined}
            >
              <button
                type="button"
                className="carousel-close"
                aria-label="Close image viewer"
                onClick={(event)=>{
                  event.stopPropagation();
                  setShowPreviewImageViewer(false);
                }}
              >
                &#215;
              </button>

              {hasMultiplePreviewImages && (
                <>
                  <button
                    type="button"
                    className="carousel-nav left"
                    aria-label="Previous image"
                    onClick={(event)=>{
                      event.stopPropagation();
                      showPreviousPreviewImage();
                    }}
                  >
                    &#8249;
                  </button>
                  <button
                    type="button"
                    className="carousel-nav right"
                    aria-label="Next image"
                    onClick={(event)=>{
                      event.stopPropagation();
                      showNextPreviewImage();
                    }}
                  >
                    &#8250;
                  </button>
                </>
              )}

              <SmartImage
                key={`${currentPreviewImage}-viewer-${previewImageIndex}`}
                src={getMemoryImageUrl(previewMemory, "images", previewImageIndex)}
                alt={previewMemory.title}
                draggable={false}
                detectFaces={false}
                onClick={(event)=>event.stopPropagation()}
              />
            </div>
          )}
        </motion.div>
      </motion.div>
    )}
    </AnimatePresence>

    {memoryToDelete && !previewDeleteActive && (
      <div className="confirm-overlay">
        <div className="confirm-dialog">
          <h3>Move to bin?</h3>
          <p>
            "{memoryToDelete.title}" will stay in trash for 30 days before it is permanently deleted.
          </p>
          <div className="confirm-actions">
            <button
              type="button"
              className="cancel-delete-btn"
              onClick={closeDeleteDialog}
            >
              Cancel
            </button>
            <button
              type="button"
              className="confirm-delete-btn"
              onClick={confirmDelete}
            >
              Move to bin
            </button>
          </div>
        </div>
      </div>
    )}

    </LayoutGroup>

  );
}

export default MemoryTimeline;
