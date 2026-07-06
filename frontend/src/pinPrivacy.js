const HIDE_PIN_HASH_PREFIX = "pin:v1";
const HASH_ITERATIONS = 120000;
const HASH_BYTES = 32;
const SALT_BYTES = 16;

const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...bytes));

const base64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const getSubtleCrypto = () => {
  const subtle = globalThis.crypto?.subtle;

  if(!subtle){
    throw new Error("Secure PIN privacy is unavailable in this browser");
  }

  return subtle;
};

const derivePinHashBytes = async (pin, salt) => {
  const subtle = getSubtleCrypto();
  const keyMaterial = await subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await subtle.deriveBits(
    {
      name:"PBKDF2",
      hash:"SHA-256",
      salt,
      iterations:HASH_ITERATIONS
    },
    keyMaterial,
    HASH_BYTES * 8
  );

  return new Uint8Array(bits);
};

export const isFourDigitHidePin = (value) => /^\d{4}$/.test(value || "");

export const isHashedHidePin = (value = "") => String(value).startsWith(`${HIDE_PIN_HASH_PREFIX}:`);

export const hasStoredHidePin = (value = "") => isFourDigitHidePin(value) || isHashedHidePin(value);

export const createHidePinValue = async (pin) => {
  if(!isFourDigitHidePin(pin)){
    throw new Error("Use a 4-digit hiding PIN");
  }

  const salt = new Uint8Array(SALT_BYTES);
  globalThis.crypto.getRandomValues(salt);
  const hash = await derivePinHashBytes(pin, salt);

  return `${HIDE_PIN_HASH_PREFIX}:${bytesToBase64(salt)}:${bytesToBase64(hash)}`;
};

export const verifyHidePinValue = async (pin, storedValue = "") => {
  if(!isFourDigitHidePin(pin)){
    return false;
  }

  if(isFourDigitHidePin(storedValue)){
    return pin === storedValue;
  }

  if(!isHashedHidePin(storedValue)){
    return false;
  }

  try{
    const [, , encodedSalt, encodedHash] = String(storedValue).split(":");
    const salt = base64ToBytes(encodedSalt || "");
    const expectedHash = base64ToBytes(encodedHash || "");
    const actualHash = await derivePinHashBytes(pin, salt);

    if(actualHash.length !== expectedHash.length){
      return false;
    }

    return actualHash.every((byte, index)=>byte === expectedHash[index]);
  }catch{
    return false;
  }
};