self.addEventListener("push", (event) => {
  let payload = {};

  try{
    payload = event.data ? event.data.json() : {};
  }catch{
    payload = {};
  }

  const title = payload.title || "Memory reminder";
  const options = {
    body:payload.body || "You have a memory reminder today.",
    icon:"/memory-timeline-icon.svg",
    badge:"/memory-timeline-icon.svg",
    tag:payload.tag || "memory-reminder",
    renotify:false,
    data:{
      url:payload.url || "/timeline"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/timeline", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({type:"window", includeUncontrolled:true});
    const sameOriginWindow = windows.find((client)=>client.url.startsWith(self.location.origin));

    if(sameOriginWindow){
      await sameOriginWindow.focus();
      sameOriginWindow.navigate(targetUrl);
      return;
    }

    await clients.openWindow(targetUrl);
  })());
});
