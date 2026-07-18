const DEFAULT_NOTIFICATION_TITLE = "Memory Timeline reminder";
const DEFAULT_NOTIFICATION_BODY = "You have an upcoming memory reminder.";
const TIMELINE_PATH = "/timeline";

const parsePushPayload = (event) => {
  if(!event.data){
    return {};
  }

  try{
    return event.data.json();
  }catch{
    return {body:event.data.text()};
  }
};

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title.trim()
    : DEFAULT_NOTIFICATION_TITLE;
  const body = typeof payload.body === "string" && payload.body.trim()
    ? payload.body.trim()
    : DEFAULT_NOTIFICATION_BODY;
  const memoryId = typeof payload.memoryId === "string" ? payload.memoryId : "";
  const reminderDate = typeof payload.reminderDate === "string" ? payload.reminderDate : "";

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon:"/memory-timeline-icon.svg",
    badge:"/memory-timeline-icon.svg",
    tag:payload.tag || `memory-reminder-${memoryId}-${reminderDate}`,
    data:{url:TIMELINE_PATH}
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(TIMELINE_PATH, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({type:"window", includeUncontrolled:true})
      .then(async(windowClients) => {
        const existingClient = windowClients.find((client) => client.url.startsWith(self.location.origin));

        if(existingClient){
          if("navigate" in existingClient){
            await existingClient.navigate(targetUrl);
          }

          return existingClient.focus();
        }

        return self.clients.openWindow(targetUrl);
      })
  );
});
