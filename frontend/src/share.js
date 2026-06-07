const copyWithFallback = (url) => {
  const textarea = document.createElement("textarea");

  textarea.value = url;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const copied = document.execCommand("copy");
  textarea.remove();

  return copied;
};

export const shareUrl = async ({title, text, url}) => {
  if(navigator.share){
    try{
      await navigator.share({title, text, url});
      return "shared";
    }catch(error){
      if(error.name === "AbortError"){
        return "cancelled";
      }

      throw error;
    }
  }

  if(navigator.clipboard?.writeText){
    try{
      await navigator.clipboard.writeText(url);
      return "copied";
    }catch{
      // Plain HTTP deployments do not expose the Clipboard API.
    }
  }

  if(copyWithFallback(url)){
    return "copied";
  }

  window.prompt("Copy this share link:", url);
  return "manual";
};
